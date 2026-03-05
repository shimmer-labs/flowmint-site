/**
 * API Route: Generation Status
 * Poll for generation job progress
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId parameter" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    totalEmails: job.total_emails,
    completedEmails: job.completed_emails,
    currentFlow: job.current_flow || null,
    currentFlowIndex: job.current_flow_index || null,
    totalFlows: job.total_flows || null,
    flowId: job.flow_id,
    flowName: job.flow_name,
  });
}
