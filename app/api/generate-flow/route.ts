/**
 * API Route: Generate Flow
 * Generates ALL emails in a single flow and saves to Supabase
 */

import { NextRequest, NextResponse } from "next/server";
import { generateEmail } from "@/app/services/email-generator.service";
import { getFlowDefinition } from "@/app/utils/flow-mappings";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to generate flows" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { flowId, brandAnalysis, platform = "klaviyo", format = "html", analysisId: rawAnalysisId } = body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const analysisId = rawAnalysisId && uuidRegex.test(rawAnalysisId) ? rawAnalysisId : null;

    if (!flowId || !brandAnalysis) {
      return NextResponse.json(
        { error: "Missing required fields: flowId, brandAnalysis" },
        { status: 400 }
      );
    }

    const flow = getFlowDefinition(flowId);
    if (!flow) {
      return NextResponse.json({ error: `Unknown flow: ${flowId}` }, { status: 400 });
    }

    const admin = createAdminClient();

    // Create generation job
    const { data: job, error: jobError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: userId,
        flow_id: flowId,
        flow_name: flow.name,
        total_emails: flow.emailCount,
        completed_emails: 0,
        status: "in_progress",
        platform,
        format,
        analysis_id: analysisId || null,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create job:", jobError);
      return NextResponse.json({ error: "Failed to create generation job" }, { status: 500 });
    }

    // Generate emails in parallel
    const emailPromises = Array.from({ length: flow.emailCount }, (_, i) =>
      generateEmail({
        flow,
        emailNumber: i + 1,
        brandAnalysis,
        platform,
        format,
      })
        .then(async (email) => {
          // Save to Supabase
          await admin.from("email_templates").insert({
            user_id: userId,
            job_id: job.id,
            flow_id: flowId,
            flow_name: flow.name,
            email_number: i + 1,
            subject: email.subject,
            preheader: email.preheader,
            body: email.body,
            platform,
            format,
            analysis_id: analysisId || null,
          });

          // Update completed count
          await admin
            .from("generation_jobs")
            .update({ completed_emails: i + 1 })
            .eq("id", job.id);

          return email;
        })
        .catch((err) => {
          console.error(`Failed to generate ${flow.name} email #${i + 1}:`, err);
          return null;
        })
    );

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(Boolean).length;

    // Update job status
    await admin
      .from("generation_jobs")
      .update({
        status: successCount === flow.emailCount ? "completed" : "partial",
        completed_emails: successCount,
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      flowId,
      flowName: flow.name,
      totalEmails: flow.emailCount,
      completedEmails: successCount,
    });
  } catch (error: any) {
    console.error("Flow generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate flow" },
      { status: 500 }
    );
  }
}
