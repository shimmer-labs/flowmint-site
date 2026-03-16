/**
 * API Route: Generate All Flows
 * Generates ALL selected flows in parallel (with concurrency limit)
 * Returns a master job ID for polling
 *
 * Architecture:
 * - Returns jobId immediately
 * - Uses after() to process in background
 * - All flows run in parallel (max 5 concurrent Claude calls)
 * - Each email has retry logic (1 retry with 2s delay)
 * - Progress updates after each email completes
 * - Job marked "failed" if background task crashes
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { generateEmail } from "@/app/services/email-generator.service";
import { getFlowDefinition } from "@/app/utils/flow-mappings";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Max concurrent Claude API calls to avoid rate limits */
const MAX_CONCURRENCY = 5;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to generate flows" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const body = await request.json();
    const {
      flowIds,
      brandAnalysis,
      platform = "klaviyo",
      format = "html",
      analysisId: rawAnalysisId,
    } = body;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const analysisId =
      rawAnalysisId && uuidRegex.test(rawAnalysisId) ? rawAnalysisId : null;

    if (!flowIds?.length || !brandAnalysis) {
      return NextResponse.json(
        { error: "Missing required fields: flowIds, brandAnalysis" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const validFlows = flowIds
      .map((id: string) => getFlowDefinition(id))
      .filter(Boolean);

    if (validFlows.length === 0) {
      return NextResponse.json(
        { error: "No valid flow IDs provided" },
        { status: 400 }
      );
    }

    let totalEmails = 0;
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
      return NextResponse.json(
        { error: "Failed to create generation job" },
        { status: 500 }
      );
    }

    // Process all flows in parallel (with concurrency limit)
    after(async () => {
      try {
        // Build a flat list of all email generation tasks
        const tasks: Array<{
          flow: (typeof validFlows)[0];
          emailNumber: number;
        }> = [];

        for (const flow of validFlows) {
          for (let i = 1; i <= flow.emailCount; i++) {
            tasks.push({ flow, emailNumber: i });
          }
        }

        let completedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // Process with concurrency limit
        const results = await runWithConcurrency(
          tasks,
          async (task) => {
            const email = await generateEmail({
              flow: task.flow,
              emailNumber: task.emailNumber,
              brandAnalysis,
              platform,
              format,
            });

            if (email.failed) {
              failedCount++;
              errors.push(
                `${task.flow.name} #${task.emailNumber}: ${email.error}`
              );
            } else {
              // Save to database (content = legacy field, body = current)
              const { error: insertError } = await admin.from("email_templates").insert({
                user_id: userId,
                job_id: masterJob.id,
                flow_id: task.flow.id,
                flow_name: task.flow.name,
                email_number: task.emailNumber,
                subject: email.subject,
                preheader: email.preheader,
                body: email.body,
                content: email.body,
                platform,
                format,
                analysis_id: analysisId || null,
              });
              if (insertError) {
                throw new Error(`DB insert failed: ${insertError.message}`);
              }
            }

            // Update progress after each email
            completedCount++;
            await admin
              .from("generation_jobs")
              .update({
                completed_emails: completedCount,
                current_flow: task.flow.name,
              })
              .eq("id", masterJob.id);

            return !email.failed;
          },
          MAX_CONCURRENCY
        );

        // Determine final status
        const successCount = results.filter(Boolean).length;
        let status: string;
        if (successCount === totalEmails) {
          status = "completed";
        } else if (successCount > 0) {
          status = "partial";
        } else {
          status = "failed";
        }

        await admin
          .from("generation_jobs")
          .update({
            status,
            completed_emails: completedCount,
            current_flow: null,
            errors: errors.length > 0 ? errors : null,
          })
          .eq("id", masterJob.id);

        console.log(
          `✅ Generation job ${masterJob.id}: ${status} (${successCount}/${totalEmails} emails, ${failedCount} failed)`
        );
      } catch (error: any) {
        console.error("Background generation crashed:", error);
        await admin
          .from("generation_jobs")
          .update({
            status: "failed",
            current_flow: null,
            errors: [error.message || "Background task crashed unexpectedly"],
          })
          .eq("id", masterJob.id);
      }
    });

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

/**
 * Run async tasks with a concurrency limit
 * Like Promise.all() but only runs N tasks at a time
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  // Spawn `concurrency` workers
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}
