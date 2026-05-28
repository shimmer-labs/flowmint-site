/**
 * Delete one or more GHL email templates by ID from the test location.
 *
 * Uses the verified V2 delete endpoint (see references/flowmintv2ghl/ghl-api-reference.md):
 *   DELETE https://services.leadconnectorhq.com/emails/public/v2/locations/{locationId}/templates/{templateId}
 *   Headers: Version: 2023-02-21, Authorization: Bearer <token>
 *   Scope: emails/builder.write (already on our PIT)
 *   Response: { deleted: true, traceId: "..." }
 *
 * Reads GHL_TEST_PIT_TOKEN + GHL_TEST_LOCATION_ID from env. Pass template IDs
 * as CLI args, or leave empty to use the baked-in list of probe IDs we created
 * during the create-template endpoint hunt.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-ghl-probes.ts             # delete known probes
 *   npx tsx --env-file=.env.local scripts/cleanup-ghl-probes.ts <id> <id>   # delete specific IDs
 *
 * The list-templates endpoint would enable a smarter "delete every template
 * whose title matches /FlowMint (PROBE|Probe)/i", but that needs the
 * emails/builder.readonly scope (not currently on the PIT). Adding that scope
 * later would unlock auto-discovery; for now we delete by explicit ID.
 */

const KNOWN_PROBE_IDS = [
  // From the FlowMint Probe DELETE-ME run that confirmed the OLD endpoint silently fails
  "6a18a7c87df235e140017614",
  // From the field-name probe sweep (html, htmlContent, templateBody, content, body, template.html, data)
  "6a18ad756ccf9777d8f78d34",
  "6a18ad76100266ee5f20c603",
  "6a18ad76100266b0f520c617",
  "6a18ad775649590d37665a38",
  "6a18ad770d3622a75c51ee69",
  "6a18ad7825033d491c0072c4",
  "6a18ad787df062714d56c1e9",
  // The REAL endpoint probe that finally proved the API takes raw HTML
  "6a18b11e1002664fdf20ee36",
];

async function main() {
  const token = process.env.GHL_TEST_PIT_TOKEN;
  const locationId = process.env.GHL_TEST_LOCATION_ID;
  if (!token || !locationId) {
    console.error(
      "GHL_TEST_PIT_TOKEN and GHL_TEST_LOCATION_ID must be set. Run with: npx tsx --env-file=.env.local scripts/cleanup-ghl-probes.ts"
    );
    process.exit(1);
  }

  const cliIds = process.argv.slice(2);
  const ids = cliIds.length > 0 ? cliIds : KNOWN_PROBE_IDS;
  console.log(`Deleting ${ids.length} template(s) from location ${locationId}...\n`);

  let okCount = 0;
  let failCount = 0;
  for (const id of ids) {
    const url = `https://services.leadconnectorhq.com/emails/public/v2/locations/${locationId}/templates/${id}`;
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Version: "2023-02-21",
          Accept: "application/json",
        },
      });
      const body = await res.text();
      if (res.ok) {
        console.log(`  ✓ ${id}`);
        okCount++;
      } else {
        // 404 is expected if the template was already deleted or never existed at this path
        // (e.g. the legacy /emails/builder probes may not be reachable via the public V2 delete).
        const tag = res.status === 404 ? "404 not found" : `${res.status}`;
        console.log(`  ✗ ${id}  (${tag}) ${body.slice(0, 200)}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`  ✗ ${id}  ${err.message}`);
      failCount++;
    }
  }

  console.log(`\nDone. ${okCount} deleted, ${failCount} failed.`);
  if (failCount > 0) {
    console.log(
      "Failures on legacy probe IDs are expected — those were created against the old /emails/builder ghost endpoint and may not be reachable via the public V2 delete. Remove from the GHL UI if any are still lingering."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
