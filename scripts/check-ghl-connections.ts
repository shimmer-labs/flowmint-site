/**
 * Quick status check on the ghl_connections table.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/check-ghl-connections.ts
 *
 * Prints every row with its location, scopes, and whether the access token
 * has expired. The authoritative answer to "did the OAuth install succeed?"
 * lives in this table; if there's a row with a valid expires_at, the round
 * trip worked. If the table is empty, the callback never ran (route missing,
 * state invalid, exchange failed, etc.).
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing env vars. Run with: npx tsx --env-file=.env.local scripts/check-ghl-connections.ts"
  );
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await admin
    .from("ghl_connections")
    .select(
      "id, user_id, location_id, auth_type, company_id, user_type, scopes, expires_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`query failed: ${error.message}`);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("ghl_connections: no rows.");
    console.log("The OAuth install has not completed end-to-end yet.");
    return;
  }

  console.log(`ghl_connections: ${data.length} row(s).\n`);
  for (const r of data) {
    // PIT rows have null expires_at (static, no refresh). Only flag OAuth rows.
    let expiryNote: string;
    if (r.expires_at == null) {
      expiryNote = "(null — PIT, no expiry)";
    } else {
      const expired = new Date(r.expires_at) < new Date();
      expiryNote = `${r.expires_at}  ${expired ? "⚠️ EXPIRED" : "✓"}`;
    }
    console.log(`  id:          ${r.id}`);
    console.log(`  user_id:     ${r.user_id}`);
    console.log(`  location_id: ${r.location_id}`);
    console.log(`  auth_type:   ${(r as any).auth_type ?? "(null)"}`);
    console.log(`  company_id:  ${r.company_id ?? "(null)"}`);
    console.log(`  user_type:   ${r.user_type ?? "(null)"}`);
    console.log(`  scopes:      ${r.scopes}`);
    console.log(`  expires_at:  ${expiryNote}`);
    console.log(`  created_at:  ${r.created_at}`);
    console.log(`  updated_at:  ${r.updated_at}`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
