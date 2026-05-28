/**
 * API Route: Integration OAuth Callback
 * Generic callback for third-party integrations. Dispatches by the provider
 * encoded in the signed state token.
 *
 * This is the URL registered with GHL marketplace as the redirect URI:
 *   http://localhost:3000/api/integrations/callback (local dev)
 *   https://flowmint.me/api/integrations/callback   (prod)
 *
 * Avoiding "ghl"/"highlevel" in the path is required by GHL's phishing guard.
 * See references/flowmintv2ghl/plan.md Slice 1.
 *
 * On success: upserts a ghl_connections row and redirects the user to
 *   /settings?connected=ghl
 * On failure: redirects with an error param so the settings page can surface
 * a real message (and we don't dead-end on a JSON blob the user can't act on).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { exchangeCodeForToken } from "@/app/lib/ghl/oauth";
import { verifyState } from "@/app/lib/ghl/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorRedirect(request: NextRequest, code: string): NextResponse {
  const url = new URL("/settings", request.url);
  url.searchParams.set("integration_error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const providerError = params.get("error");

  // The provider can return its own error param (user denied, scope rejected, etc.).
  if (providerError) {
    console.error(`OAuth callback: provider error: ${providerError}`);
    return errorRedirect(request, `provider_${providerError}`);
  }

  if (!code || !state) {
    console.error("OAuth callback: missing code or state");
    return errorRedirect(request, "missing_params");
  }

  let payload;
  try {
    payload = verifyState(state);
  } catch (err: any) {
    console.error(`OAuth callback: state verify failed: ${err?.message}`);
    return errorRedirect(request, "invalid_state");
  }

  // Dispatch by provider. Only "ghl" today; future "notion" etc. would branch here.
  if (payload.provider !== "ghl") {
    console.error(`OAuth callback: unknown provider: ${payload.provider}`);
    return errorRedirect(request, "unknown_provider");
  }

  let token;
  try {
    token = await exchangeCodeForToken(code);
  } catch (err: any) {
    console.error(`OAuth callback: token exchange failed: ${err?.message}`);
    return errorRedirect(request, "token_exchange_failed");
  }

  if (!token.locationId) {
    // We requested Location-level user_type; if GHL returns no locationId,
    // something is off with scopes or app config. Surface it cleanly.
    console.error(
      `OAuth callback: token response missing locationId; userType=${token.userType}`
    );
    return errorRedirect(request, "no_location_id");
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const admin = createAdminClient();
  const { error: upsertError } = await admin
    .from("ghl_connections")
    .upsert(
      {
        user_id: payload.uid,
        location_id: token.locationId,
        company_id: token.companyId ?? null,
        user_type: token.userType ?? null,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
        scopes: token.scope,
      },
      { onConflict: "user_id,location_id" }
    );

  if (upsertError) {
    console.error(
      `OAuth callback: ghl_connections upsert failed: ${upsertError.message}`
    );
    return errorRedirect(request, "persist_failed");
  }

  const successUrl = new URL("/settings", request.url);
  successUrl.searchParams.set("connected", "ghl");
  return NextResponse.redirect(successUrl);
}
