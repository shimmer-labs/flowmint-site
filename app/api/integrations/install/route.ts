/**
 * API Route: Integration Install
 * Kicks off an OAuth install for a third-party integration (currently: GHL).
 *
 * Flow: user clicks "Connect GHL" in the UI -> hits this route -> we mint a
 * signed state token tying the install to their FlowMint account and redirect
 * them to the provider's authorize URL.
 *
 * URL path intentionally avoids "ghl"/"highlevel" because GHL marketplace
 * forbids those substrings in registered redirect URIs (phishing guard).
 * Even though this URL is internal-only, keeping the namespace consistent
 * with the callback URL makes the convention obvious.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { buildAuthorizeUrl } from "@/app/lib/ghl/oauth";
import { signState } from "@/app/lib/ghl/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "ghl") {
    return NextResponse.json(
      { error: `unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Bounce the user through login, then back here after.
    const returnTo = `/api/integrations/install?provider=${provider}`;
    const loginUrl = `/login?redirectTo=${encodeURIComponent(returnTo)}`;
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  const state = signState(user.id, provider);
  const authorizeUrl = buildAuthorizeUrl(state);
  return NextResponse.redirect(authorizeUrl);
}
