/**
 * API Route: Claim Analysis
 *
 * When someone analyzes a site while logged out, the row is saved with
 * user_id = NULL. After they sign up (homepage promise: "preview free, then
 * sign up"), this links that orphaned analysis to their new account so it
 * shows up on their dashboard and is theirs to generate from.
 *
 * Idempotent: only claims rows that are still unowned (user_id IS NULL).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { analysisId } = await request.json().catch(() => ({}));
  if (!analysisId) {
    return NextResponse.json({ error: "Missing analysisId" }, { status: 400 });
  }

  // Service role: the row's user_id is NULL, so RLS would block the user from
  // updating it themselves. This is a best-effort, fire-and-forget claim — never
  // surface an error to the client (e.g. a malformed/non-UUID id just claims 0).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_analyses")
    .update({ user_id: user.id })
    .eq("id", analysisId)
    .is("user_id", null)
    .select("id");

  if (error) {
    console.warn("claim-analysis skipped:", error.message);
    return NextResponse.json({ claimed: 0 });
  }

  return NextResponse.json({ claimed: data?.length ?? 0 });
}
