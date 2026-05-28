/**
 * GHL OAuth helpers
 *
 * Constants, URL builder, and token-exchange / token-refresh calls.
 *
 * VERIFY: endpoint URLs against the GHL marketplace docs at
 * https://marketplace.gohighlevel.com/docs before the first install attempt.
 * The shapes here follow GHL's widely-published V2 OAuth pattern but the exact
 * marketplace authorize host (marketplace.gohighlevel.com vs
 * marketplace.leadconnectorhq.com) is the most common gotcha.
 *
 * The integration is a private OAuth app. See:
 *   - references/flowmintv2ghl/ghl-api-reference.md (auth section)
 *   - references/flowmintv2ghl/COORDINATION.md (auth decision)
 */

// GHL OAuth endpoints (V2). VERIFY before first install.
export const GHL_AUTHORIZE_URL =
  "https://marketplace.gohighlevel.com/oauth/chooselocation";
export const GHL_TOKEN_URL =
  "https://services.leadconnectorhq.com/oauth/token";

/** GHL token response shape (from /oauth/token). */
export interface GhlTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string; // "Bearer"
  scope: string; // space-separated
  locationId?: string;
  companyId?: string;
  userType?: string; // "Company" | "Location"
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

/** Build the GHL authorize URL the user gets redirected to during install. */
export function buildAuthorizeUrl(state: string): string {
  const clientId = requireEnv("GHL_CLIENT_ID");
  const redirectUri = requireEnv("GHL_REDIRECT_URI");
  const scopes = requireEnv("GHL_OAUTH_SCOPES");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  return `${GHL_AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchange an authorization code for an access/refresh token pair. */
export async function exchangeCodeForToken(
  code: string
): Promise<GhlTokenResponse> {
  const clientId = requireEnv("GHL_CLIENT_ID");
  const clientSecret = requireEnv("GHL_CLIENT_SECRET");
  const redirectUri = requireEnv("GHL_REDIRECT_URI");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    // GHL also accepts user_type; default is Location which is what we want.
    user_type: "Location",
  });

  const res = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `GHL token exchange failed (${res.status}): ${errorBody.slice(0, 500)}`
    );
  }

  return (await res.json()) as GhlTokenResponse;
}

/** Refresh an expired access token using the refresh token. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<GhlTokenResponse> {
  const clientId = requireEnv("GHL_CLIENT_ID");
  const clientSecret = requireEnv("GHL_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    user_type: "Location",
  });

  const res = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `GHL token refresh failed (${res.status}): ${errorBody.slice(0, 500)}`
    );
  }

  return (await res.json()) as GhlTokenResponse;
}
