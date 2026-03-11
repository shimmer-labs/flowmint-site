/**
 * API Route: Generate All Flows
 * Generates all selected flows serially (emails within each flow in parallel)
 * Returns a master job ID for polling
 */

import { NextRequest, NextResponse } from "next/server";
import { generateEmail } from "@/app/services/email-generator.service";
import { getFlowDefinition } from "@/app/utils/flow-mappings";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // Auth check — need userId to save templates
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to generate flows" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { flowIds, brandAnalysis, platform = "klaviyo", format = "html", analysisId: rawAnalysisId } = body;
    // Only use analysisId if it's a valid UUID (temp IDs from anonymous analysis aren't)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const analysisId = rawAnalysisId && uuidRegex.test(rawAnalysisId) ? rawAnalysisId : null;

    if (!flowIds?.length || !brandAnalysis) {
      return NextResponse.json(
        { error: "Missing required fields: flowIds, brandAnalysis" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Calculate total emails across all flows
    let totalEmails = 0;
    const validFlows = flowIds
      .map((id: string) => getFlowDefinition(id))
      .filter(Boolean);

    if (validFlows.length === 0) {
      return NextResponse.json({ error: "No valid flow IDs provided" }, { status: 400 });
    }

    for (const flow of validFlows) {
      totalEmails += flow.emailCount;
    }

    // Create master generation job
    const { data: masterJob, error: jobError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: userId,
        flow_id: "all",
        flow_name: `${validFlows.length} flows`,
        total_emails: totalEmails,
        completed_emails: 0,
        status: "in_progress",
        platform,
        format,
        analysis_id: analysisId || null,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create master job:", JSON.stringify(jobError));
      return NextResponse.json({ error: "Failed to create generation job" }, { status: 500 });
    }

    // Process flows serially, emails within each flow in parallel
    // Run in background — don't await (client polls for status)
    (async () => {
      let completedTotal = 0;
      let currentFlowIndex = 0;

      for (const flow of validFlows) {
        currentFlowIndex++;

        // Update job with current flow info
        await admin
          .from("generation_jobs")
          .update({
            current_flow: flow.name,
            current_flow_index: currentFlowIndex,
            total_flows: validFlows.length,
          })
          .eq("id", masterJob.id);

        // Generate all emails in this flow in parallel
        const emailPromises = Array.from({ length: flow.emailCount }, (_, i) =>
          generateEmail({
            flow,
            emailNumber: i + 1,
            brandAnalysis,
            platform,
            format,
          })
            .then(async (email) => {
              await admin.from("email_templates").insert({
                user_id: userId,
                job_id: masterJob.id,
                flow_id: flow.id,
                flow_name: flow.name,
                email_number: i + 1,
                subject: email.subject,
                preheader: email.preheader,
                body: email.body,
                platform,
                format,
                analysis_id: analysisId || null,
              });
              return true;
            })
            .catch((err) => {
              console.error(`Failed: ${flow.name} email #${i + 1}:`, err);
              return false;
            })
        );

        const results = await Promise.all(emailPromises);
        completedTotal += results.filter(Boolean).length;

        await admin
          .from("generation_jobs")
          .update({ completed_emails: completedTotal })
          .eq("id", masterJob.id);
      }

      // Mark complete
      await admin
        .from("generation_jobs")
        .update({
          status: completedTotal === totalEmails ? "completed" : "partial",
          completed_emails: completedTotal,
          current_flow: null,
        })
        .eq("id", masterJob.id);
    })();

    return NextResponse.json({
      success: true,
      jobId: masterJob.id,
      totalFlows: validFlows.length,
      totalEmails,
    });
  } catch (error: any) {
    console.error("Generate-all error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start generation" },
      { status: 500 }
    );
  }
}
