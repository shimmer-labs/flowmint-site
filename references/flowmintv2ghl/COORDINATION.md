# COORDINATION.md

Cross-session state. Read this at the start of every session. Update it at the end of every session. Memory survives session boundaries because it lives here, not in chat history.

**Roadmap + work status are canonical in `plan.md`. This file is the decisions log + cross-session handoff — record *why* and *what changed*, not a duplicate slice checklist.**

---

## Current phase

CRAWL — shipped and live on flowmint.me as of 2026-05-30: analyze → generate (GHL-default, correct merge fields) → preview first email → connect GHL via PIT (just-in-time modal, live token test) → push with re-push dedup + "Synced to GHL" status. Per-call perf metrics instrumented (migration-007). Demo recorded for Reed; Reed + Josh testing. WALK items stay parked in `plan.md`. See `PRODUCT_BRIEF.md` for phase scope.

## Decisions made

- Extend the existing FlowMint codebase in place to add GHL as an integration. No separate project, no FlowMint crawl/map step. The Claude Code session runs in the FlowMint directory.
- The product shape is template-generation-and-push, with manual human wiring of workflows inside GHL. The GHL API cannot create or edit workflows (confirmed).
- We will run AI evals on the email-generation step to measure and optimize generation speed, alongside the GHL build.
- The reference docs (CLAUDE.md, PRODUCT_BRIEF.md, plan.md, COORDINATION.md, ghl-api-reference.md, SKILL.md files) live under `references/flowmintv2ghl/`, not at the repo root. There is already a comprehensive `CLAUDE.md` at the repo root for flowmint-site; the GHL brief is namespaced under references on purpose.
- `~/flowmint` (the Shopify app) is a quarry, not a dependency. Nothing from it is needed to ship the CRAWL GHL slice. Its `flow-mappings.ts` and `prompt-builder.service.ts` are tempting future ports for quality, not blockers.
- Architecture section of `references/flowmintv2ghl/CLAUDE.md` is filled in. Where generation lives, how it is invoked, config and secrets, build/lint commands, and the cross-project relationship are all documented there.

## Decisions made this session (cont'd)

- **AUTH MODEL REVERSED (May 28 2026):** CRAWL uses Private Integration Tokens (PIT), not the marketplace OAuth flow. After burning multiple iteration cycles on marketplace gotchas (`noAppVersionIdFound`, prod-not-deployed 404, paid-apps-install-via-marketplace, no-pricing-plans-found, apps-not-editable-once-published), the OAuth path is too costly for CRAWL. PIT is faster to ship, matches existing FlowMint UX (Klaviyo paste-a-token), and Reed can generate PITs per client sub-account himself. OAuth code stays in the repo on-shelf for RUN, when we add it as a second install path alongside PIT for one-click marketplace installs. See [[ghl-crawl-uses-pit-not-oauth]].
- AUTH MODEL (original, now stale): private OAuth app from day one. Kept here for context — see the reversal above.
- PATH HOUSEKEEPING DONE: all internal references inside `references/flowmintv2ghl/` now point to `references/flowmintv2ghl/<file>` instead of imaginary `docs/...` paths. Verified `grep` returns no stale `docs/ghl-api-reference` references.
- SKILL HOUSEKEEPING DONE: both skills now live at `flowmint-site/.claude/skills/ghl-merge-field-generator/SKILL.md` and `flowmint-site/.claude/skills/ghl-template-push/SKILL.md`. The old `references/flowmintv2ghl/SKILL.md` and the `mnt/user-data/outputs/...` nesting are deleted.
- ROADMAP DISCIPLINE: `plan.md` is alive. Items get checked off as they ship; asides get parked in the Parking lot section the moment they're said; the lot is re-ranked against CRAWL/WALK/RUN. Pilot cohort is Reed + 2 office beta testers; we prioritize for "testable in someone else's hands" until they have it.

## Open decisions (not yet made)

(none currently blocking)

## Findings from orientation (March 2026)

### Architecture (full detail in `references/flowmintv2ghl/CLAUDE.md`)
- Next.js 15, TS, Supabase, Stripe, Anthropic Claude Sonnet 4 via raw `fetch` (no SDK).
- Generation: `app/services/email-generator.service.ts` → `app/services/claude-api.service.ts`. Retries once after 2 s. 90 s timeout.
- Invocation: `POST /api/generate-{email,flow,all}`. The `generate-all` route is the production path: async via Next.js `after()`, 5 concurrent emails, polled by `/api/generation-status`.
- Push seam for GHL: `app/api/push-to-platform/route.ts` dispatch + a new `ghl` entry in `app/utils/platform-syntax.ts`.
- No tests. `npm run build` is the only typecheck. The eval workstream will need its own harness.

### Reuse verdict on ~/flowmint: REUSE PARTS LATER, IGNORE FOR NOW
- Not needed for CRAWL.
- Future port candidates: the richer `flow-mappings.ts`, `prompt-builder.service.ts`, the GetResponse + Shopify Email syntax blocks, `validateApiKey()`.
- Skip entirely: Prisma layer, React Router scaffold, Shopify-specific billing and OAuth code.
- No filesystem coupling; deleting `~/flowmint` would not break flowmint-site.

### Cross-sync risks (full detail in the session report)
- Highest-risk drift surfaces today: `flow-mappings.ts` (862 vs 128 lines) and `platform-syntax.ts` (6 platforms + validator vs 5 platforms, no validator).
- Lower-risk drift: Claude API wrapper, email generator orchestration, BrandAnalysisResult shape, GeneratedEmail `body` vs `content`. None of these are blocking GHL.
- For GHL specifically: maintain the GHL platform entry in flowmint-site only. Do not back-port to `~/flowmint`. Treat flowmint-site as the new source of truth going forward.

## Current phase checklist

- [x] Run `/init` and fill in the architecture section of CLAUDE.md.
- [x] Locate FlowMint's AI generation step and document where it lives.
- [x] Make the auth-model decision and record it here. → **private OAuth app.**
- [x] Patch path references inside `references/flowmintv2ghl/`.
- [x] Move SKILL.md files into a real `.claude/skills/` directory so both skills register.
- [x] Draft the Phase 0 plan in `references/flowmintv2ghl/plan.md`.
- [x] Slice 3 baseline measured (see Eval results log below).
- [x] Slice 1 plan annotation cycle (one round).
- [x] **Slice 1 OAuth code written and building cleanly.** Migration, install/callback routes, lib/ghl helpers. Pending: manual install verification on Logan's test sub-account (requires migration applied + dev server).

## Next steps (in order)

**(Superseded 2026-05-30. These were the OAuth marketplace-install deploy steps from before the PIT pivot and the CRAWL ship. Kept for history. Live next steps are in `plan.md`: the email-quality CRAWL verify path, live GHL sync verification, and the WALK parking lot.)**

1. Migration ✅ applied. App profile/version/pricing ✅ filled in (resolved `noAppVersionIdFound`). Marketplace install attempt on shimmerlabs sub-account → GHL generated a real OAuth `code` and sent it to `https://flowmint.me/api/integrations/callback?code=...`. Production 404'd because the new routes haven't been deployed yet. Code is burned.
2. **Logan (Vercel):** add to project env vars: `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI=https://flowmint.me/api/integrations/callback` (prod value, NOT localhost), `GHL_OAUTH_SCOPES`, `OAUTH_STATE_SECRET`. Without these prod will throw at runtime.
3. **Logan (git):** commit + push to main. Vercel auto-deploys. Confirm build succeeds in Vercel before retrying install.
4. **Logan (GHL):** uninstall FlowMint from shimmerlabs sub-account (the current install has no token on our side; dead weight). Then re-trigger install via FlowMint's own route: `https://flowmint.me/api/integrations/install?provider=ghl`, signed in to FlowMint in the same browser. **Do not use the marketplace UI install button** — that path sends no state and our callback rejects it (state-less marketplace installs are parked as WALK).
5. **Verify:** run `npx tsx --env-file=.env.local scripts/check-ghl-connections.ts`. Expect one row with valid token and future `expires_at`.
6. Once verified: start Slice 2 (GHL platform entry in generator + em-dash fix + push-or-export UX flow).

## Eval results log

(Record baseline and each optimization here so it survives compaction.)

### Baseline — 2026-05-28
- **Model:** `claude-sonnet-4-20250514` (Sonnet 4) via raw `fetch`. No prompt caching, no batching.
- **Inputs:** 5 URLs (Logan's beta cohort): joshdeanphotography, outbackrestorationandroofing, goldenoaklawn, empirefence, mintdetail.
- **Flow:** welcome (3 emails). Platform: klaviyo. Format: html.
- **Latency (end-to-end per URL = scrape + analyze + 3 emails generated serially):**
  - median 120.0s, range 92.8s–184.4s
  - scrape: 10s–92s (highly variable; goldenoaklawn was 92s, mintdetail was 10s)
  - analyze: 5–6s (consistent)
  - per-email generation: median 26.9s, p95 33.2s
- **Quality:**
  - Em-dashes in 3/5 URLs. All instances were in email #2 of the welcome flow ("brand story" email). Counts: 1, 1, 2.
  - Subject, preheader, body length, personalization: ✅ all passed across all 15 emails.
  - Failed generations: 0.
- **Classification spot-check:**
  - joshdeanphotography → `photography-services` ✅ accurate
  - outbackrestorationandroofing → `home-services-contractor` ✅ spot-on
  - goldenoaklawn → `local-service-business` ⚠️ accurate but generic (didn't pick up "landscaping / lawn care" specifically)
  - empirefence → `local-construction-services` ✅ accurate
  - mintdetail → `mobile-service-business` ✅ accurate
  - **No misclassifications.** None of the 5 service businesses got tagged as e-commerce / online retailer. The classification spot-check passes for this cohort.
  - Open question for WALK: do the `recommendFlows(businessModel)` mappings return e-com-centric flows (cart-abandonment, browse-abandonment) for these classifications? If so, the analyzer is right but the flow library is wrong. To check during Slice 5 rehearsal.
- **Observations / next levers:**
  - Per-email gen at ~27s is the dominant cost; not the scrape. Optimization workstream should start with prompt caching of the stable brand-context prefix (it's identical across the 3 emails for one URL).
  - Em-dash bug is small. One-line prompt fix in `email-generator.service.ts` ("Never use em dashes. Use commas, periods, or rewrites."). Surfaces in Slice 2 as part of the prompt rework anyway, but could land sooner.
  - Variable scrape time (10s vs 92s) is a separate concern; parked.

### Post-optimization — 2026-05-28 (later same day)
- **Changes applied:**
  - Adopted `@anthropic-ai/sdk` (was raw fetch).
  - Migrated model `claude-sonnet-4-20250514` → `claude-sonnet-4-6`.
  - Added `thinking: {type: "disabled"}` + `output_config: {effort: "low"}` to keep latency parity (4.6 defaults to `effort: "high"`).
  - Restructured `email-generator.service.ts` prompt: stable brand/format/platform context moved to system messages with `cache_control: {type: "ephemeral"}` on the per-URL block. Per-email variable content stays in the user message.
- **Verified caching works:** probe call shows `cache_creation_input_tokens=1534` on first call, `cache_read_input_tokens=1534` on second call. Empirical Sonnet 4.6 cache minimum is below the 2048-token figure in the docs we'd quoted.
- **Re-baseline (same 5 URLs):**
  - Per-email gen median: **26.9s (unchanged)** — cache helps cost, not latency, at this prefix size. Most of the 25-27s is output gen at the 2000-token cap.
  - Per-email gen p95: 306s (much worse). Caused by SDK's built-in retry-on-rate-limit compounding with our outer retry. Median unaffected; investigate if tails become user-visible.
  - End-to-end median: 155s (worse than 120s baseline, but scrape variance accounts for the gap — we didn't change scrape code).
  - Em-dashes: **1/5 URLs (down from 3/5)** — Sonnet 4.6's stronger instruction-following on system-prompt hard rules.
  - Classification: 5/5 correct, unchanged.
- **Cost impact (full-campaign math):**
  - 54 emails per URL × ~1100 input tokens uncached ≈ 88K input tokens / URL → $0.26 at $3/M
  - With cache (1 write + 53 reads): ~14K effective input tokens / URL → $0.04
  - **~8% total cost reduction per URL**; meaningful only at Reed's expected volume across many clients.
- **Real wins:** em-dash compliance improved, deprecation pressure removed (Sonnet 4 retires 2026-06-15), SDK adoption unlocks future features (streaming, batches) and proper typed errors.
- **Walked-back claims:** the "3-8s per email" latency improvement I'd implied did not materialize. Output dominates at this prompt size.
- **Tuning items parked:** raise `max_tokens` from 2000 → 2500-3000 (4.6 at effort:low writes longer emails; some are hitting the cap); investigate p95 outliers if Reed/Josh report slowness; consider pre-warm fan-out to save 4 extra cache-writes per campaign.

## Perf-metrics task (task #26) — 2026-05-29

- **Supabase MCP:** was NOT actually configured at session start (absent from `claude mcp list` and `~/.claude.json`). Added it this session: `claude mcp add supabase-flowmint -s local -e SUPABASE_ACCESS_TOKEN=... -- npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=fcibehadmkbasqnwhenr`. Server shows ✓ Connected, but its **tools don't load into an already-running session** — a Claude Code restart is required before the MCP is callable. Token came from Logan (pasted in chat); it lives in `~/.claude.json` (untracked), not the repo.
- **Code shipped, `npm run build` green:**
  - `app/services/claude-api.service.ts` — `callClaude` returns `{ text, usage }` (normalized `ClaudeUsage`: input/output/cache_read/cache_create); `CLAUDE_MODEL` now exported.
  - `app/services/email-generator.service.ts` — `GeneratedEmail.metrics` (gen_ms, tokens, model, prompt_version); `EMAIL_PROMPT_VERSION = "2026-05-28-sdk-cache-v1"`.
  - `app/services/brand-analysis.service.ts` — `analyzeBrand` returns `{ analysis, usage }` (`AnalyzeBrandResult`).
  - `app/api/generate-all/route.ts` — threads per-email metrics into `email_templates` insert.
  - `app/api/analyze/route.ts` — times scrape + analyze, threads metrics into `brand_analyses` upsert.
  - `app/api/ai-edit/route.ts` — destructures `{ text }` (no metrics persisted there).
  - `scripts/ghl-baseline-eval.ts` — updated for new `analyzeBrand` shape (4th caller, caught by build).
  - `scripts/perf-summary.ts` — new readout script.
- **Migration applied + verified (2026-05-29):** `supabase/migration-007-perf-metrics.sql` applied by Logan in the SQL editor. Verified live via `npx tsx --env-file=.env.local scripts/perf-summary.ts` — selecting the new columns ran clean (PostgREST would error on a missing column), so both tables have them. No rows with metrics yet (nothing generated since apply).
- **Schema backup re-exported (DONE 2026-05-30):** `references/supabase-schema.md` is now a full live re-export via the read-only Supabase MCP (columns/indexes/RLS via `execute_sql`, FKs via `list_tables`), reflecting migration-007 + 008 + `ghl_connections`. The read-only MCP is enough to refresh it — no SQL-editor round-trip, no restart. (The earlier "needs a Claude Code restart" note only applied to the first mid-session load.)

## Notes for the next session

- Architecture section in `references/flowmintv2ghl/CLAUDE.md` is real, not a TODO. Re-read it before touching code.
- Auth model: CRAWL ships on PIT (shipped + live). OAuth code is on-shelf for RUN. The earlier "OAuth-only, do not write PIT code" guidance is superseded — see "AUTH MODEL REVERSED" above.
- `plan.md` is alive. Check off items as they ship. Park asides immediately. Re-rank.
- Pilot cohort = Reed + 2 office testers. Prioritize for "testable in someone else's hands."
- Before writing OAuth code, run the plan.md annotation cycle on Slice 1 with Logan.
