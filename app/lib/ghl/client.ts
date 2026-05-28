/**
 * Authenticated GHL fetch wrapper.
 *
 * Loads a user's ghl_connections row for the target location, attaches the
 * bearer token, calls the GHL API.
 *
 * Two auth modes coexist:
 *   - PIT (auth_type='pit'): static token, no refresh. expires_at is null.
 *     On 401 we surface the error (the user must rotate the token in GHL).
 *   - OAuth (auth_type='oauth'): refreshes proactively when expires_at is near,
 *     and reactively on 401. CRAWL doesn't exercise this path; code stays
 *     on-shelf for RUN. See references/flowmintv2ghl/plan.md.
 *
 * Used by app/api/push-to-platform/route.ts (Slice 4) and any future GHL caller.
 * Do NOT call GHL fetch directly elsewhere; always go through this.
 */

import { createAdminClient } from "@/app/lib/supabase/admin";
import { refreshAccessToken } from "./oauth";

/** Skew window: refresh OAuth tokens proactively if they expire within this many ms. */
const REFRESH_SKEW_MS = 60_000;

/**
 * Default GHL Version header. Most V2 endpoints use 2021-07-28, but a few newer
 * surfaces (e.g. `emails/public/v2/...`) require 2023-02-21. Callers can override
 * by setting their own `Version` header in `init.headers`; this default only
 * applies when the caller didn't specify one.
 */
const GHL_API_VERSION_DEFAULT = "2021-07-28";

interface GhlConnectionRow {
  id: string;
  user_id: string;
  location_id: string;
  auth_type: "oauth" | "pit";
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null; // ISO string; null for PIT rows
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
  if (!conn.refresh_token) {
    throw new Error(
      `cannot refresh: connection ${conn.id} has no refresh_token (auth_type=${conn.auth_type})`
    );
  }
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

function isExpiringSoon(conn: GhlConnectionRow): boolean {
  // PIT tokens have null expires_at; we don't refresh them.
  if (!conn.expires_at) return false;
  return Date.parse(conn.expires_at) - Date.now() < REFRESH_SKEW_MS;
}

/**
 * Fetch a GHL V2 endpoint with the user's per-location access token.
 *
 * OAuth path: refreshes proactively if expiry is within REFRESH_SKEW_MS,
 * and reactively on 401 (single retry).
 *
 * PIT path: no refresh. 401 surfaces directly — the user must rotate the
 * token in GHL and update FlowMint's stored value.
 */
export async function ghlFetch(
  userId: string,
  locationId: string,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  let conn = await loadConnection(userId, locationId);

  // Proactive refresh (OAuth only; PITs skip this path).
  if (conn.auth_type === "oauth" && isExpiringSoon(conn)) {
    conn = await refreshAndPersist(conn);
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${conn.access_token}`);
  // Only set the default Version if the caller didn't specify one.
  // Different GHL endpoints require different Version values (e.g. emails/public/v2/* uses 2023-02-21).
  if (!headers.has("Version")) {
    headers.set("Version", GHL_API_VERSION_DEFAULT);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status !== 401) {
    return res;
  }

  // Reactive refresh path: only OAuth can recover. PITs surface the 401 as-is.
  if (conn.auth_type !== "oauth") {
    return res;
  }

  conn = await refreshAndPersist(conn);
  headers.set("Authorization", `Bearer ${conn.access_token}`);
  res = await fetch(url, { ...init, headers });
  return res;
}
