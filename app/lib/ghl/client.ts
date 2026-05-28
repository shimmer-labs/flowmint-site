/**
 * Authenticated GHL fetch wrapper.
 *
 * Loads a user's ghl_connections row for the target location, attaches the
 * access token, calls the GHL API. On 401, refreshes the token, persists the
 * new token, and retries the request once.
 *
 * Used by the push-to-platform route (Slice 4) and any future GHL API caller.
 * Do NOT call GHL fetch directly elsewhere; always go through this.
 */

import { createAdminClient } from "@/app/lib/supabase/admin";
import { refreshAccessToken } from "./oauth";

/** Skew window: refresh proactively if the token expires within this many ms. */
const REFRESH_SKEW_MS = 60_000;

/** GHL Version header pinned for V2 endpoints. VERIFY against latest GHL docs. */
const GHL_API_VERSION = "2021-07-28";

interface GhlConnectionRow {
  id: string;
  user_id: string;
  location_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO string
  scopes: string;
}

async function loadConnection(
  userId: string,
  locationId: string
): Promise<GhlConnectionRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ghl_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) {
    throw new Error(`failed to load ghl_connections row: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `no ghl_connections row for user=${userId} location=${locationId}`
    );
  }
  return data as GhlConnectionRow;
}

async function persistRefreshedToken(
  rowId: string,
  newAccessToken: string,
  newRefreshToken: string,
  expiresInSec: number,
  scope: string
): Promise<void> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  const { error } = await admin
    .from("ghl_connections")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
      scopes: scope,
    })
    .eq("id", rowId);
  if (error) {
    throw new Error(`failed to persist refreshed token: ${error.message}`);
  }
}

async function refreshAndPersist(
  conn: GhlConnectionRow
): Promise<GhlConnectionRow> {
  const fresh = await refreshAccessToken(conn.refresh_token);
  await persistRefreshedToken(
    conn.id,
    fresh.access_token,
    fresh.refresh_token,
    fresh.expires_in,
    fresh.scope
  );
  return {
    ...conn,
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token,
    expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
    scopes: fresh.scope,
  };
}

/**
 * Fetch a GHL V2 endpoint with the user's per-location access token.
 *
 * Refreshes proactively if expiry is within REFRESH_SKEW_MS, and reactively on 401.
 * The first 401 triggers a refresh + retry. A second 401 surfaces as an error;
 * we do not loop.
 */
export async function ghlFetch(
  userId: string,
  locationId: string,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  let conn = await loadConnection(userId, locationId);

  // Proactive refresh: if token expires soon, refresh before sending.
  if (
    Date.parse(conn.expires_at) - Date.now() < REFRESH_SKEW_MS
  ) {
    conn = await refreshAndPersist(conn);
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${conn.access_token}`);
  headers.set("Version", GHL_API_VERSION);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status !== 401) {
    return res;
  }

  // Reactive refresh path: token rejected, try once more.
  conn = await refreshAndPersist(conn);
  headers.set("Authorization", `Bearer ${conn.access_token}`);
  res = await fetch(url, { ...init, headers });
  return res;
}
