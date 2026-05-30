# plan.md

The living plan for current work. This is the checklist you verify your own work against before marking anything done. **This file is alive.** Check items off as they complete; park new asides immediately; re-rank against CRAWL / WALK / RUN.

## How to use this file (the annotation cycle)

1. The agent drafts a plan here.
2. Logan opens it and adds inline notes wherever the agent made a wrong call or left something ambiguous (e.g. "push via API, not UI export").
3. Logan sends it back with the guard phrase: **"address all notes, don't implement yet."**
4. Repeat until the plan has zero ambiguity.
5. Only then implement, verifying against the acceptance criteria below.

Without the guard phrase the agent will skip planning and start coding. Use it.

---

## Approach

Extend the existing FlowMint codebase in place to add GHL as an integration. Work within FlowMint's existing conventions (`app/services/`, `app/api/<route>/route.ts`, `app/utils/`, `app/lib/`). Auth is a private OAuth app from day one; do not write PIT code. Pilot cohort is Reed plus 2 office beta testers; "minimum testable in someone else's hands" beats "feature-complete" until they're using it.

## Status

Phase 0 complete. Slice 1 (OAuth foundations) shipped as code-on-shelf, then we pivoted to PIT (Private Integration Tokens) after marketplace app gotchas burned multiple iteration cycles. Decision and reasoning logged in `references/flowmintv2ghl/COORDINATION.md` "Decisions made." OAuth code stays in the repo for RUN; CRAWL uses PIT.

Slice 1B (PIT settings UI + save route + ghlFetch PIT support) is built and building cleanly. Pending: Logan applies migration-005, then ships first end-to-end PIT save + push.

**2026-05-30 reality update (roadmap had drifted; re-syncing now).** CRAWL is effectively shipped end-to-end and live on flowmint.me: analyze → generate (GHL-default) → preview → connect GHL (PIT, just-in-time modal) → push. A demo-polish sprint ran outside this slice plan and shipped: GHL-default platform on results, one-email "wow" flow, honest loading, beta mode (paywalls off, pricing greyed), Brand-Card-first results, dashboard intro + GHL status, just-in-time GHL connect modal with live token test, race-safe FlowMint folder creation, push dedup + "Synced to GHL" status (migration-008), orphaned-analysis claim-on-signup, and the GHL Liquid-`{% %}`-in-bodies fix. Demo recorded for Reed; Reed + Josh testing. Slice 2 and Slice 4 build items are now done (checked off below). A 2026-05-30 email audit surfaced three generation-quality issues — see "Email-quality fixes (CRAWL)" below.

---

## Phase 0: Orientation and groundwork — COMPLETE ✅

- [x] Run `/init`; fill in the architecture section of CLAUDE.md.
- [x] Locate the AI generation step.
- [x] Settle the auth model decision: **private OAuth app**.
- [x] Reuse audit of `~/flowmint`.
- [x] Cross-sync risk report logged in `references/flowmintv2ghl/COORDINATION.md`.
- [x] Path/skill housekeeping.

Open item:
- [x] Baseline generation latency. **Measured 2026-05-28**, recorded in `references/flowmintv2ghl/COORDINATION.md` eval log. Headline: end-to-end median 120s per URL, per-email median 27s. Em-dashes in 3/5 URLs (all in email #2 of welcome). Classification correct for all 5 service-business URLs.

---

## Prereqs to clear before Slice 1 (Logan actions, not agent build items)

These resolve open questions from the first annotation pass. Slice 1 build items can't start until these are done.

1. **Verify GHL developer account status.**
   - Go to https://marketplace.gohighlevel.com/ (the developer marketplace, distinct from the agency UI at app.gohighlevel.com).
   - Sign in with your existing GHL credentials.
   - In the dashboard, look for "My Apps" or a "Create App" button.
   - If it's there → you already have developer access. Start a draft app named "FlowMint" (private). Note the `client_id` and `client_secret` for env vars.
   - If it's not there → create a developer account on that domain. Free, separate from your agency login. Then start the draft app.
   - The affiliate/agency access Reed added you to does NOT grant app-creation rights by itself. You need your own developer account. Once you've created the FlowMint app, Reed (or you) can install it on his test sub-accounts for OAuth testing.
   - Confirm you have at least one sub-account you can install against (your own or a sandbox under Reed's agency).

2. **Pick a Supabase schema reference strategy.**
   - Option A: install the Supabase MCP for this project. Future sessions get live schema. Setup once, frictionless forever.
   - Option B: one-shot SQL export checked in at `references/supabase-schema.sql`. Five minutes; no MCP install.
   - **Recommendation: do B now to unblock Slice 1; park A as a WALK-phase task.** B is the shortest path to a real reference file we can read.
   - To do B: run the four queries below in the Supabase SQL editor for the project, paste each result block into `references/supabase-schema.sql` under a labeled comment, commit the file. Re-export whenever a migration lands.

   ```sql
   -- 1. Columns
   SELECT table_name, column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position;

   -- 2. Indexes
   SELECT tablename, indexname, indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename;

   -- 3. RLS policies
   SELECT schemaname, tablename, policyname, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;

   -- 4. Foreign keys
   SELECT
     tc.table_name, kcu.column_name,
     ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
   JOIN information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
   ORDER BY tc.table_name;
   ```

3. **Encryption at rest decision (resolved, no Logan action required unless you disagree).** See the encryption block on Slice 1.

---

## CRAWL slices

### Slice 1: GHL OAuth foundations

**Goal:** A logged-in FlowMint user can click "Connect GHL," install the app on a sub-account, and FlowMint stores a working access/refresh token pair for that location.

Resolved from the first annotation pass:
- **Account status:** see Prereq 1.
- **Scopes (confirmed from GHL portal):** `locations.readonly` + `emails/builder.write`. (Note the slash in `emails/builder.write` — that's GHL's real scope syntax, not a typo.) Both saved to `.env.local` as `GHL_OAUTH_SCOPES`. Logan flagged that we'll likely need `locations/customFields.readonly` and friends later for fancier Custom Values integration; parked as a WALK item.
- **Token storage:** new Supabase table `ghl_connections`. Reads from `references/supabase-schema.sql` (Prereq 2) to confirm no name collisions and to match existing migration conventions.
- **Encryption at rest:** column-level token encryption is **deferred to WALK**, parked. Rationale:
  - Supabase Postgres encrypts data at rest at the disk layer by default. Column encryption is separate (defense in depth against a service-role-key leak), not "is it encrypted at all."
  - The real threat is leak of `SUPABASE_SERVICE_ROLE_KEY` from Vercel env. Column encryption doesn't fully mitigate that because the server still has to use the token. The real mitigation is short-blast-radius env handling and rotation if a leak occurs.
  - This matches the security posture flowmint-site already uses for stored Klaviyo API keys in `user_settings`. We are not introducing new risk by matching it.
  - Pre-condition to revisit: before the first paying multi-location customer, or before any non-Logan-controlled deployment. Tracked in the parking lot.

**URL naming constraint (discovered while registering the redirect URI):** GHL's marketplace rejects any redirect URI containing the substrings `ghl` or `highlevel` (phishing guard against impersonator redirect URIs). So our public-facing URLs (the ones we register with GHL and that appear in browser address bars during install) must avoid those substrings. Resolution:
- **Callback (registered with GHL):** `/api/integrations/callback`. Dispatches by `provider` encoded in the state token. Forward-looking for future integrations.
- **Install entry point (internal only, not registered with GHL):** `/api/integrations/install?provider=ghl`. Triggered when the user clicks "Connect GHL" in the UI; redirects them to GHL's authorize URL.
- **Internal code can still say `ghl`.** Module names, env vars, table names, and the `provider=ghl` query param are fine; GHL only validates the registered redirect URI string.

Build items:
- [x] Add env vars: `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`, `GHL_OAUTH_SCOPES`, plus `OAUTH_STATE_SECRET` (auto-generated 32-byte hex, used for HMAC-signing state tokens). All in `.env.local`.
- [x] Supabase migration written: `supabase/migration-004-ghl-connections.sql`. Includes `company_id`, `user_type` columns (not in original spec) since GHL's token response carries those and they're useful for agency-scope work later. Logan to apply via Supabase SQL editor.
- [x] `app/api/integrations/install/route.ts` — reads `?provider=ghl`, requires auth (bounces to login with `?redirectTo=` if not signed in), generates signed state token, redirects to GHL authorize URL.
- [x] `app/api/integrations/callback/route.ts` — verifies state, dispatches by provider, exchanges code for token, upserts `ghl_connections` row (admin client), redirects to `/settings?connected=ghl` on success or `/settings?integration_error=...` on failure.
- [x] `app/lib/ghl/oauth.ts` — endpoint URLs (marked VERIFY) + `buildAuthorizeUrl` + `exchangeCodeForToken` + `refreshAccessToken`. `app/lib/ghl/state.ts` — HMAC-SHA256 sign/verify with 15-min TTL. `app/lib/ghl/client.ts` — `ghlFetch(userId, locationId, url, init)` wrapper with proactive (60s skew) + reactive (one-shot on 401) refresh, persists new token.
- [x] `npm run build` passes. Both routes show up in the build output.
- [ ] **Manual verify path (Logan):** apply migration ✅, start dev server ✅, hit install URL → **blocked on GHL portal config**. Marketplace returned `error.noAppVersionIdFound` + `No integration found with the id: <client_id>`. The draft private app has no installable app version. Resolution: Logan creates a version in the dev portal (or completes the minimum publish flow privately). Once unblocked, retry; if the round-trip works, mark this done and proceed to Slice 2.

### Slice 2: GHL platform entry in the generator + push-or-export UX flow

**Goal:** When the user lands on the templates page and picks GHL as the destination, the generator emits GHL-correct merge fields (fallbacks always, Custom Values for stable business data, no em dashes), AND the UI knows to require a connected GHL location before push.

Resolved from the first annotation pass:
- **Product flow stays the same.** Today's flow is `URL → scan → results + flow recommendations → generate → preview → (paywall) export or push`. The GHL integration plugs in at the destination-picker step on the templates page. We are NOT changing the upstream URL → scan → recommendations flow in this slice.
- **Login flow stays the same.** flowmint-site already requires a logged-in user for export/push (purchase-gated). Free users can analyze and preview without login. GHL push lives behind the same paywall as Klaviyo push.
- **"Use GHL OAuth as the FlowMint login": rejected for this build.** GHL OAuth is location-scoped, not user-identity-scoped, so it does not give us a stable user ID the way Google or GitHub OAuth do. Keep email/password for FlowMint login; treat GHL as a separate "connect your account" action (same shape as "connect Stripe" or "connect Klaviyo" in other SaaS tools). If the underlying concern is "don't make testers remember a password," the cheaper answer is flipping Supabase Auth to magic links — that's a small separate change and is parked.
- **Custom-values sourcing: keep recommendation (c) for CRAWL** (the generator invents `{{custom_values.*}}` keys based on what the copy needs). Validate with Reed and Josh in Slice 6 to decide whether to upgrade to (a) (extract during brand analysis) or pull from the client's existing GHL Custom Values list for WALK.
- **Misclassification risk is a real CRAWL concern, not a parking item.** Many beta-cohort test URLs will be local service businesses (plumbers, roofers); the existing flow library is e-commerce-centric. Slice 3 includes a manual classification spot-check for every test URL. If the analyzer miscategorizes a plumber as an "online retailer," that's a Slice-3 surfacing, not something we discover during demo. (ICP-aware flow template expansion is still WALK and parked separately.)

Build items:
- [x] Add `ghl` entry to `app/utils/platform-syntax.ts` matching the rules in `.claude/skills/ghl-merge-field-generator/SKILL.md`.
- [x] Update `app/services/email-generator.service.ts` to inject the merge-field generator rules block into the prompt when `platform === "ghl"`. Include the "invent `{{custom_values.*}}` keys as needed" instruction. **2026-05-30 follow-up:** the shared base prompt also injected a Liquid `{% if %}` conditional block for GHL, which GHL ships as literal text — fixed by giving GHL its own instruction set (no `{% %}`, inline `||` only).
- [x] **Em-dash fix (cross-platform, surfaced by baseline).** Done — `STABLE_EXPERT_PROMPT` hard-rule. (Note: the live homepage hero still has an em dash — parked.)
- [x] Templates-page platform picker: add GHL as an option. (Results page now defaults to GHL + keeps the switcher.)
- [x] "Push to GHL" CTA: just-in-time "Connect to GoHighLevel" modal on the templates page (PIT, not the OAuth install route) with live token test + 3 states.
- [x] Spot-check: verified live — GHL email generates `{{contact.first_name || "there"}}` + `{{custom_values.*}}`, no `person.*`, no em dashes, no `{% %}` after the fix.

### Slice 3: AI generation baseline + classification spot-check (parallel with Slices 1-2)

**Goal:** Record a real baseline latency and quality number so the eval workstream has a starting point. Also verify the analyzer correctly classifies the kinds of businesses we're about to demo to.

Pin down (Logan provides):
- 3-5 test URLs across verticals. At minimum: one local service business (plumber or roofer — the highest-risk ICP), one e-commerce, one info product or B2B SaaS. Reed and Josh likely have specific URLs in mind; ask them for one each.

Build items:
- [x] `scripts/ghl-baseline-eval.ts` — script written, takes URL list, runs analyze + generate-flow, captures latency + quality.
- [x] Run baseline against Logan's 5 URLs.
- [x] Classification spot-check: all 5 classified as service businesses (no e-com misclassification). Open WALK question: do recommended-flow mappings still return e-com flows for these classifications? Verify in Slice 5.
- [x] Numbers recorded in `references/flowmintv2ghl/COORDINATION.md`.
- [x] No optimization applied. Baseline locked.

Findings that fall out of the baseline:
- **Em-dash bug:** all 3 em-dash hits were in welcome email #2 ("brand story" content). One-line prompt fix in `email-generator.service.ts`. Folded into Slice 2 build items.
- **Latency lever 1 (prompt caching):** per-email gen is ~27s × 3 = 81s of the ~120s end-to-end. Brand context is identical across the 3 emails for one URL — prime candidate for Anthropic `cache_control`. Tracked in AI eval workstream below.
- **Latency lever 2 (scrape variance):** scrape time ranges 10s–92s across the 5 URLs. Separate concern, parked.

### Slice 4: GHL push endpoint + handoff messaging

**Goal:** From the templates page, the user clicks "Push to GHL," picks a connected location, and FlowMint creates the template(s) in that location via V2 API. Success toast names the next manual step (wire the template into a workflow).

Resolved:
- **Endpoint:** verify exact URL + payload + response shape against `references/flowmintv2ghl/ghl-api-reference.md` immediately before implementing. The API ref names the family ("Email Templates v2") but does not pin the request body shape; that gets confirmed against GHL's official docs at code time.
- **One template per email, no folders, for CRAWL.** Folders are WALK.
- **Purchase gating:** GHL push uses the same gates as Klaviyo push. Beta testers get unlimited access via DB flag (see "Prep before Slice 6"), not by removing gates.

Build items:
- [x] Add `pushToGHL` branch in `app/api/push-to-platform/route.ts`. Pushes to the FlowMint folder (race-safe lazy creation), V2 templates endpoint. **WALK was "no folders"; we shipped a single FlowMint folder in CRAWL.**
- [x] Wire the actual push from the "Push to GHL" UI.
- [x] Post-push toast names the human-wiring step; `email_templates` now records `pushed_to_platform`, `pushed_at`, `ghl_template_id`, `pushed_location_id` (migration-008). Re-push dedupes (skips emails already pushed to that location) so it no longer duplicates templates in the folder. "Synced to GHL" badges on the templates page.
- [ ] **Verify path (Logan):** push to a test sub-account, confirm it appears in GHL, wire into a workflow, trigger with a test contact, merge fields render. (Logan's live bug-test — pending.)

### Email-quality fixes (CRAWL — surfaced by 2026-05-30 email audit)

Audited recent `email_templates` in Supabase. Findings + placement:

1. **Truncation (CRAWL, high).** `generateEmail` sets `maxTokens: 2000` (`email-generator.service.ts:79`). HTML emails run ~5,500–7,400 chars; recorded `output_tokens` hit the cap exactly (1998 / 2000 / 2000) and ~18 of the last 25 HTML emails have **no `</html>`** — they're cut off mid-document. Root cause is the token ceiling, not the prompt. Fix: raise `maxTokens` (HTML needs ~4096; test against the baseline URLs to confirm no quality regression) and add a preferred-length guardrail so the footer reliably fits. Was parked as a WALK "bump to 2500–3000"; **pulled up to CRAWL** — truncated emails aren't beta-ready.
   - [ ] Raise maxTokens to ~4096, re-run baseline eval, confirm `</html>` present + no quality regression. Bump `EMAIL_PROMPT_VERSION`.

2. **Missing unsubscribe (CRAWL, high — compliance).** Same root cause: the footer (with `{{message.unsubscribe_url}}`) is the last thing written, so truncation drops it. `has_unsub_token` is false on most truncated emails, true on the ones that closed cleanly. The prompt already *requires* the unsubscribe; it just gets cut. The maxTokens fix should resolve it.
   - [ ] After the token fix, re-audit: every generated email contains an unsubscribe link. Consider a belt-and-suspenders post-generation check that appends a standard footer if the model omitted one.

3. **CTA links not sourced from the scanned site (WALK).** GHL emails correctly use `{{custom_values.booking_url}}` / `{{custom_values.website_url}}` / `{{custom_values.review_url}}` for CTAs (right pattern — no hardcoding). But we never harvest the real URLs from the scan, and the generator isn't passed any site URLs, so those Custom Values render empty unless the client sets them in GHL. Folds into the parked "link asset extraction into GHL Custom Values" item. CRAWL-lite mitigation worth considering: thread the real site/booking URL into the generation context so there's a sensible value. Kept WALK for now.

### Slice 5: Internal rehearsal

**Goal:** Logan runs the full flow end-to-end on his own (or a dummy) GHL location without intervention. Catches anything the slices missed.

Build items:
- [ ] Full path: signup → analyze → generate flow → connect GHL → push → wire in GHL → trigger → email renders.
- [ ] Capture any UX friction or copy gaps as parking-lot entries before beta.

### Prep before Slice 6: Whitelist Reed + Josh as Unlimited

Not a build slice. Manual DB operation; takes 30 seconds per tester.

- [ ] Have Reed and Josh sign up via the normal flow (email/password) so a `profiles` row exists.
- [ ] In Supabase, set `profiles.plan = 'unlimited'` and `profiles.unlimited_expires_at = '2027-01-01'` (or any far-future date) for both. No Stripe involvement.
- [ ] Matches existing FlowMint pricing semantics. Gives them unfettered access to export, push, AI edit, and the campaign calendar. No code changes required.
- [ ] If we need to add a third tester fast, same DB flip works.

(Stripe discount-code approach is the cleaner alternative once GHL pricing is set; parked.)

### Slice 6: Beta cohort (Reed + Josh + one more)

**Goal:** Three external installs working without Logan intervention. Targeted feedback collected.

Build items:
- [ ] Plain-language "how to connect GHL" doc, one page, with a screenshot. Lives in `app/support/page.tsx` or a new help section.
- [ ] Feedback channel: a hardcoded "How's it going?" link or an in-app prompt. Cheap, not perfect.
- [ ] **Tester feedback questions to bake in:**
  - Did the analyzer classify your business correctly? (Misclassification check from Slice 3 done at scale.)
  - Does the generator's choice of Custom Value keys match what's already in your GHL Custom Values list? If we could pull your existing Custom Values list from GHL and reuse those, would you want that? (Resolves the (a)/(b)/(c) Custom Values question.)
  - Should pricing be usage-based (per-brand or per-flow) or monthly? Both? (Ask AFTER they've seen value, not before.)
  - What broke or surprised you in the install flow?
- [ ] Watch for: install failures, wrong-scope errors, merge-field rendering issues at real-data scale, generation latency complaints.

---

## AI eval workstream (runs alongside the GHL build)

Goal: measure and optimize the time it takes to generate emails, so the GHL integration ships on a fast generation step rather than baking in a slow one.

- [ ] Baseline recorded (covered by Slice 3).
- [x] **Perf instrumentation landed (2026-05-29).** `callClaude` now returns `{ text, usage }`; per-email metrics (`gen_ms`, token counts, `model`, `prompt_version`) persist to `email_templates` and per-analysis metrics (`scrape_ms`, `analyze_ms`, token counts) to `brand_analyses` (migration-007, all nullable). `scripts/perf-summary.ts` prints per-flow median/p95 gen_ms, cache hit rate, and token totals by model+prompt_version over the last N days. Pending: Logan applies migration-007 in the SQL editor, then re-export `references/supabase-schema.md`. Prompt-version tag is `2026-05-28-sdk-cache-v1` (bump on the Slice 2 prompt rework).
- [ ] Optimization levers to test, one at a time, measuring each against baseline:
  - Prompt tightening / shorter system prompt
  - Model choice (Sonnet 4 → Haiku 4.5 where quality holds)
  - Streaming vs waiting for full completion
  - Batching or parallelizing multi-template generation (already partly done by `generate-all`)
  - Prompt caching of the stable brand-context prefix (Anthropic `cache_control`)
- [ ] Speed gains must not regress quality. A faster email that sends "Hi ," is a failure. Track both numbers together.
- [ ] Record results (prompt version, model, latency, quality) in `references/flowmintv2ghl/COORDINATION.md`.

---

## Parking lot

Asides and "would be cool someday" items. One line each: what it is, effort (S/M/L), impact, phase. Re-ranked when something gets added.

**Pulled-up to "consider for CRAWL" only if Slice 3 forces our hand:**
- **ICP-aware flow library expansion.** Build flow templates for local service businesses (plumbers, roofers, HVAC, electricians) using existing FlowMint flows as a base plus research. Effort: L. Impact: high (sales credibility with Reed's pipeline). Phase: WALK by default; could become CRAWL if Slice 3 reveals the analyzer or flow library miscategorizes the beta cohort's test URLs. Notes: separate dedicated session per Logan's call.

**WALK candidates:**
- ~~**Raise email-gen `max_tokens` from 2000 → 2500-3000.**~~ **PULLED UP TO CRAWL (2026-05-30).** The 05-30 audit showed it's not "some calls" — most HTML emails truncate (no `</html>`, and the unsubscribe gets cut). See "Email-quality fixes (CRAWL)" above. Bump to ~4096 + length guardrail + re-baseline.
- **Investigate p95 outliers on email-gen.** Post-opt eval saw p95 jump to 306s due to the SDK's auto-retry-on-rate-limit compounding with our outer retry on transient API pressure. Median is fine. If Reed/Josh report slowness on real usage, dig in (cap SDK retries, surface the retry count to the eval log). Effort: S–M. Impact: medium (only if it surfaces). Phase: WALK.
- **Pre-warm fan-out for cache writes.** Current concurrency=5 in `generate-all` means the first batch of 5 calls all write the cache — only the second batch onwards reads. Sending 1 priming call, awaiting the first token, then firing the remaining 4 saves 4 cache-writes per campaign (~$0.02 saving per URL). Tiny effort, tiny impact, easy to do whenever. Effort: S. Impact: low. Phase: WALK.
- **Custom Menu link + SSO into FlowMint (the "GHL sidebar shortcut").** Add FlowMint as a Custom Menu item in the GHL marketplace app config; clicking it opens flowmint.me in a new tab with the user already authenticated via the encrypted user-context blob (`postMessage` + AES decrypt with our Shared Secret). Kills the email/password login step AND the location-ID paste in one move. Pre-conditions: re-engage the marketplace app (now informed by the lessons we just learned — pricing model "Free" not Freemium, all required fields filled, etc.); add a `/api/sso/ghl` route that decrypts the blob and creates/matches a FlowMint user; add the menu URL config to the GHL app. Effort: M (~1 week). Impact: high — Reed sees FlowMint in his GHL sidebar without leaving GHL's chrome. Phase: WALK. Decided 2026-05-28 as the right WALK move once we have Reed/Josh CRAWL feedback.
- **Per-brand sub-folders inside FlowMint.** Today we drop every pushed template into a single "FlowMint" folder per GHL location. For an agency like Reed that pushes for multiple clients into a single GHL location (unusual but possible), templates from different brands would mix together. WALK option: nest brand-named sub-folders under FlowMint (e.g. "FlowMint / ShimmerLabs"), cached on the analysis or per-push. Effort: M. Impact: low for typical Reed workflow (one client per sub-account); higher if agencies route multiple brands through one sub-account. Decide after Reed/Josh feedback.
- **Tear out `BETA_OPEN_ACCESS` when real pricing flips on.** Set to `true` in local + Vercel (confirmed 2026-05-30); a `NEXT_PUBLIC_BETA_OPEN_ACCESS` client twin greys out in-app pricing + hides paywalls. Bypasses every paywall by short-circuiting `hasUnlimitedAccess`. Before charging anyone, set it to `false` in Vercel and verify the purchase flow works end-to-end (which surfaces the Stripe test/live key mismatch below). Effort: S (config flip + verify). Impact: high (revenue). Phase: WALK / RUN.
- **Stripe test-mode price IDs.** Local `.env.local` has live-mode Stripe price IDs (`price_1T9bdS0rJcMXVHwsR6A5kbm5` etc. per `app/lib/stripe.ts`) but a test-mode `STRIPE_SECRET_KEY`, so `/api/checkout` throws "No such price... a similar object exists in live mode" when paywalled flows try to purchase. Fix: keep a parallel set of test-mode price IDs, pick based on environment, or use Stripe restricted keys. Effort: S. Impact: low while `BETA_OPEN_ACCESS=true` masks it; high when we flip beta off. Phase: WALK.
- **Settings UX pass for platform connections.** The settings page now has two separate concepts: "Email Platform" (single platform + API key, the old user_settings flow for Klaviyo/Mailchimp/etc.) and "GHL Locations" (a list of connected sub-accounts via PIT). For users this is confusing — two different "connect to push" surfaces with different shapes. Worth a proper UX/UI pass to either unify them or differentiate them visually with stronger affordances. Effort: M. Impact: medium (matters for Reed/Josh demo confidence). Phase: WALK.
- **Connection liveness pulse.** Right now we save a connection and never re-check it. PITs are static but can be rotated, revoked, or have scopes edited away. Periodically (daily? on each settings-page load?) call `GET /locations/{locationId}` with the stored token and surface "✓ working" / "⚠️ token rejected, re-connect" badges on each connection row. Catches silent breakage before the next push. Effort: S-M. Impact: medium (saves a debugging cycle when a token goes stale). Phase: WALK.
- **Pricing model: per-push / per-location / flat.** Now that connecting multiple GHL locations is easy (Reed will connect one per client), the pricing decision needs to include "do we charge per push, per connected location, per analyzed brand, or flat?" Bundle with the existing GHL pricing decision when we have Reed and Josh feedback. Phase: WALK.
- **Marketplace-initiated install (state-less callback).** When a user installs the FlowMint app via the GHL marketplace UI button (not via our `/api/integrations/install` route), the callback arrives without a `state` parameter. Our current code rejects this. To support it, treat absent state as "marketplace-initiated," require the user to be signed into FlowMint at callback time (use the auth cookie), and bind the resulting `ghl_connections` row to that session's user. If they're not signed in, redirect to `/login?redirectTo=...` and re-issue the callback. Effort: M (state-machine + login interleave is fiddly). Impact: medium-high (matters for Reed's pipeline — he'd want to install from the marketplace, not from FlowMint). Phase: WALK; pull up to CRAWL if Reed says he won't install via FlowMint's UI.
- **Em-dash on live homepage hero.** "Works with any site — Shopify, WooCommerce, Squarespace, or custom." on `app/page.tsx` violates the no-em-dashes brand rule. Visible in the GHL marketplace screenshot `01-homepage-hero.png`. Effort: S (one-char swap to a comma or rewrite). Impact: low (cosmetic) but it's the kind of thing a careful reviewer notices. Phase: WALK; fix opportunistically.
- **Baseline eval script JSON-stdout cleanup.** Scraper service uses `console.log` with emoji prefixes (`🔍 Scraping ...`), which leaks into stdout alongside the eval script's JSON output and breaks downstream JSON parsing. Fix: in the script, redirect `console.log` to stderr or capture-then-write JSON last. Effort: S. Impact: low (summary already prints clean to stderr; only matters if we want to pipe results into other tools). Phase: WALK.
- **Scrape latency variance investigation.** scrape times ranged 10s–92s across baseline URLs (goldenoaklawn was the slow one). Worth a profile pass on `scraper.service.ts` to find the slow path (probably product-page fan-out). Effort: M. Impact: low–medium (knocks ~30s off worst-case end-to-end). Phase: WALK.
- **`recommendFlows(businessModel)` audit for service businesses.** Baseline showed correct business-type classification, but we never checked which flows the recommender returns for `home-services-contractor`, `photography-services`, etc. If those mappings still return e-com flows (cart-abandonment, browse-abandonment, etc.), the recommendations are wrong even though the classification is right. Effort: S (audit) / M-L (rebuild mappings if needed). Impact: high for demo quality. Phase: WALK; pull up to CRAWL if Slice 5 surfaces it.
- **Additional GHL scopes for richer integrations.** Likely `locations/customFields.readonly` (read existing Custom Values list so the generator can reuse the client's existing keys instead of inventing new ones), plus whatever's needed for folder organization and stats pull-back. Effort: S (request scopes + re-prompt user to reauthorize). Impact: medium (unblocks Custom Values (c)→(a)/(GHL-sourced) upgrade and the WALK-phase stats workstream). Phase: WALK.
- **GHL pricing decision (usage-based vs monthly).** Decide after Slice 6 feedback from Reed and Josh. Effort: S (decision) / M (Stripe products). Impact: high (revenue). Phase: WALK.
- **Stripe beta-tester coupon flow.** Once GHL pricing lands, replace the DB-flag whitelist with a Stripe 100% coupon for the beta cohort. Effort: S. Impact: low. Phase: WALK.
- **Magic-link auth for FlowMint login.** If "don't make testers remember a password" turns into real friction, flip Supabase Auth from email/password to magic links. Effort: S. Impact: low–medium. Phase: WALK.
- **Supabase MCP install.** Live schema access for future sessions instead of relying on the check-in. Effort: M. Impact: medium (drift reduction). Phase: WALK.
- **Column-level encryption for GHL tokens.** Port the `~/flowmint/app/utils/encryption.server.ts` pattern. Pre-condition: before the first paying multi-location customer, or before any non-Logan-controlled deployment. Effort: M. Impact: medium (defense in depth). Phase: WALK.
- **AI image generation based on site images (NOT logo/QR).** Generate on-brand hero/section images for templates from the brand's site imagery. Effort: M-L. Impact: medium-high (visual polish on demos). Phase: WALK.
- **Image and link asset extraction from URL scan into GHL.** During brand analysis, harvest logos, QR codes, and booking links that are on the site but not yet in the client's GHL location; offer to upload to GHL Custom Values / Media. Effort: M. Impact: medium. Phase: WALK. Likely combines with the (c) → (a) upgrade for Custom Values sourcing.

**Demo-polish deferrals (added 2026-05-30 — shipped the core, parked these):**
- **Live "synced" verification against GHL (deleted-in-GHL case).** Reed/Logan ask: the "Synced to GHL" badges reflect our DB push record, not GHL reality. On templates load (or a daily background pass), GET each pushed template by `ghl_template_id`; on 404, clear `ghl_template_id`/`pushed_at` so the badge drops and a re-push recreates it. Combines with "Connection liveness pulse" above. Effort: M (N API calls, debounce/cache). Impact: medium. Phase: WALK.
- **Update an edited template in GHL on re-push.** Dedup currently skips emails already pushed to a location, so AI-editing then re-pushing won't update the GHL copy. Needs GHL's template-update (PUT) endpoint — verify it exists in `ghl-api-reference.md` first; if not, delete-by-id + recreate. Effort: M. Impact: medium. Phase: WALK.
- **Mobile email-preview clipping.** Fixed-width email tables clip on ~375px (results sample + templates preview). Constrain the preview container / scale it down. Effort: S. Impact: low–medium (testers likely on desktop). Phase: WALK.
- **Flow-generation progress bar: fully indeterminate.** Emails generate in parallel (concurrency 5), so a 3-email flow jumps nothing→done and a determinate bar can't show real increments. Switch to an indeterminate "Writing your N emails…" animation for the whole (short) wait. Effort: S. Impact: low. Phase: WALK.
- **Signup email-confirm redirect.** Auto-confirm path already returns to `/results?id=&flow=`; if email confirmation is ever turned on, pass `emailRedirectTo` with `?next=` at `signUp` so the confirm link returns to the right place (the callback already honors `next`). Effort: S. Impact: low. Phase: WALK.

**Already shipped — confirm and drop from this list:**
- **AI-prompt template edit sidebar.** Logan's memory: "we built something like this." Confirmed: it's live in flowmint-site at `app/api/ai-edit/route.ts`, gated by "any purchase" (per CLAUDE.md: "AI template editing unlocked by any purchase, not tier-gated"). Originally built in `~/flowmint` per the `templates-ai-edit-open.png` screenshot, ported to flowmint-site. **Logan to confirm the existing UI matches the memory; if it does, delete this bullet next time you touch the file.**

---

## Acceptance criteria (the checklist to verify against)

GHL integration:
- [ ] Generated template uses correct, case-correct merge-field syntax.
- [ ] Every personalization field has a fallback.
- [ ] Stable business data uses Custom Values, not hardcoded text.
- [ ] No em dashes in any generated copy.
- [ ] Template pushes to a GHL test location via the V2 API without manual UI steps.
- [ ] Template renders correctly in a GHL test/preview with real contact data.
- [ ] No workflow-creation code (the API cannot do it; humans wire it).
- [ ] Integration follows existing FlowMint conventions, no unrequested refactors.
- [ ] Codebase health verified (`npm run build`) at start and end of the task.

AI eval:
- [ ] Baseline latency and quality recorded before any optimization.
- [ ] Each optimization measured against baseline, one change at a time.
- [ ] No quality regression accepted in exchange for speed.
- [ ] Final chosen config (model, prompt version, latency, quality) recorded in `references/flowmintv2ghl/COORDINATION.md`.

Beta-ready:
- [ ] Logan can run the full flow on his own GHL location end-to-end without code intervention.
- [ ] Reed and Josh are flagged as Unlimited in Supabase.
- [ ] One-page "how to connect" doc exists.
- [ ] Feedback channel is in place with the 4 priority questions baked in.
