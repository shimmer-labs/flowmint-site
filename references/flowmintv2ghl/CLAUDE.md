# CLAUDE.md

Always-on context for FlowMint. Keep this short and human-readable. Loaded into every session. This is the foundation and the index, not a documentation dump. Detailed docs live in the files this one points to.

---

## What we are building

We are adding Go High Level (GHL) as an integration to the existing FlowMint codebase. FlowMint already generates email content; we are extending it so it can push on-brand, merge-field-correct templates into a client's GHL location via the GHL V2 Email Templates API. A human then wires those templates into a GHL workflow by hand, because the GHL API cannot create or edit workflows.

The human-wiring step is not a limitation to apologize for. It is the human-in-the-loop seam, and it is on brand.

This is an in-place extension of FlowMint, not a new project. Work within the existing codebase and its conventions. Run `/init` if a starter CLAUDE.md has not already been generated, then fold what you learn about the existing stack into the architecture section below.

Phase we are in: CRAWL (see PRODUCT_BRIEF.md). Do not build WALK or RUN features unless the brief says we have moved phases.

---

## Reference index (read these when relevant, do not inline them here)

- `references/flowmintv2ghl/PRODUCT_BRIEF.md` — what we are building and why, the crawl/walk/run plan, scope guardrails. Re-read before any architectural decision.
- `references/flowmintv2ghl/plan.md` — the living plan for current work, including the AI eval workstream. The annotation cycle lives here. This is the checklist you verify your own work against before marking anything done.
- `references/flowmintv2ghl/COORDINATION.md` — cross-session state: decisions made, current phase, next steps. Read this at the start of every session.
- `references/flowmintv2ghl/ghl-api-reference.md` — curated GHL API capabilities (can/cannot), merge-field syntax, marketplace path. The source of truth for what the API supports. Do not guess GHL API behavior, check here, and if it is not here, say so.

---

## Architecture and conventions

Filled in March 2026 after orientation pass. Keep accurate; this is what stops you from misplacing files.

### Stack
- Next.js 15 (App Router), TypeScript, Tailwind, React 18. Hosted on Vercel.
- Supabase for auth and Postgres. RLS on user data; service-role admin client (`SUPABASE_SERVICE_ROLE_KEY`) is used in background writes.
- Stripe Checkout (one-time and subscription) with webhook at `app/api/webhooks/stripe/route.ts`.
- Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`), called via raw `fetch` to `/v1/messages` in `app/services/claude-api.service.ts`. No Anthropic SDK, no prompt caching, no Batch API. 90 s `AbortController` timeout.

### Where email generation lives
- `app/services/email-generator.service.ts` builds the per-email prompt and calls Claude. Brand context + platform syntax + flow-specific guidance + HTML/plain format instructions are concatenated inline. Retries once on failure with a 2 s delay; on second failure returns a "failed" placeholder template instead of throwing.
- `app/services/brand-analysis.service.ts` runs upstream of generation. Uses `app/services/scraper.service.ts` (Cheerio) to pull site content, then Claude to extract voice, colors, audience, business model, recommended flows.
- `app/services/claude-api.service.ts` is the thin Claude wrapper described above. The single seam to touch if we add prompt caching, the SDK, or batching later.
- `app/utils/flow-mappings.ts` is a thin flow catalog (id, name, emailCount, priority, description) plus `recommendFlows(businessModel)`. Lean compared to the sibling `~/flowmint` version; richer per-flow metadata lives there if we ever port it back.
- `app/utils/platform-syntax.ts` holds per-platform merge-field and unsubscribe syntax (Klaviyo, Mailchimp, Customer.io, ActiveCampaign, OmniSend). `getSyntaxInstructions(platformId)` produces the syntax block injected into every generation prompt. The GHL platform entry will land here.

### How the AI generation step is invoked
- `POST /api/generate-email` for one email, synchronously.
- `POST /api/generate-flow` for one flow, synchronously.
- `POST /api/generate-all` starts an async job. Writes a `generation_jobs` row, then uses Next.js `after()` to process up to 5 emails concurrently via a `runWithConcurrency` helper, persisting each to `email_templates` and updating job progress. The client polls `GET /api/generation-status`. `maxDuration = 300`.
- `POST /api/ai-edit` runs a single Claude call to edit an existing template (purchase-gated by `canAIEdit`).

### Push to email platforms
- `app/api/push-to-platform/route.ts` is the unified push endpoint. Klaviyo and Mailchimp are implemented for real; ActiveCampaign / Customer.io / OmniSend are stubs that throw "coming soon."
- Purchase gating via `getUserPurchases`, `hasUnlimitedAccess`, `canExportFlowClient` (`app/lib/plan-gating.ts` + `app/lib/plan-gating-client.ts`).
- The GHL push is a new branch in the `pushTemplate` dispatcher, plus an OAuth-aware token lookup. Auth model is the still-open decision (see COORDINATION.md).

### Config and secrets
- All via `process.env`, no `.env` checked in. Required: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Optional: `KLAVIYO_API_KEY`.
- GHL will add (assuming OAuth): `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`, `GHL_OAUTH_SCOPES`, and a Supabase table or column for storing the per-location access/refresh token pair.

### Build, test, lint
- `npm run dev` — local dev server.
- `npm run build` — production build; this is the only typecheck path (Next runs `tsc` as part of build).
- `npm run start` — production server.
- `npm run lint` — ESLint.
- No test suite exists. There is no `npm test`. Verification today means `npm run build` + manual click-through. Plan for the eval workstream is to add a script-based eval harness rather than a unit-test framework, since the thing under test is end-to-end generation latency and quality.

### Database tables relevant to this work
- `profiles`, `purchases`, `analyses`, `email_templates`, `generation_jobs`, `user_settings`. See root `CLAUDE.md` for the credit model details.
- GHL connection storage is new. Likely a `ghl_connections` table or columns on `user_settings`; defer that to the slice plan.

### Plan/roadmap maintenance discipline

`references/flowmintv2ghl/plan.md` is alive. Treat it as a working document, not a one-shot artifact.

- Whenever a slice or item is completed, check it off in `plan.md` in the same commit and surface what changed in the reply.
- Whenever the user says "oh, this would be cool to do someday" or any similar aside, immediately add it to the **Parking lot** section of `plan.md` with a one-line effort/impact note. Do this even if it derails the current slice. The reply should explicitly say you parked it.
- After parking, re-rank the parking lot against CRAWL / WALK / RUN. Things that unblock CRAWL get pulled up; WALK and RUN items stay parked.
- The pilot cohort is Reed plus 2 office beta testers. Until they have hands on it, prioritize for "minimum testable in someone else's hands," not "feature-complete."
- Update `references/flowmintv2ghl/COORDINATION.md` (decisions made, current state, next steps) at the end of every session.

### Conventions
- Match existing patterns. Service files in `app/services/`, route handlers in `app/api/<route>/route.ts`, shared utils in `app/utils/`, shared client/server libs in `app/lib/`.
- Files are commented with header docstrings explaining purpose; follow that style.
- Console-based logging (no structured logger). Don't introduce one unless asked.
- Use the simplest approach that works. Do not add abstractions, helper functions, or refactors that were not asked for.
- Surface key assumptions before implementing. If more than one valid approach exists, present the options instead of silently choosing.
- Verify codebase health (`npm run build`) at the start and end of every task. Do not leave broken code behind.

### Sibling project: ~/flowmint
- Separate Shopify-app codebase, not imported here. Deleting it would not break flowmint-site.
- Has a richer `flow-mappings.ts`, a dedicated `prompt-builder.service.ts`, two extra platforms in `platform-syntax.ts`, and per-platform push routes. None of it is required for the CRAWL GHL slice.
- Treat it as a quarry, not a dependency. Reach for it only if a specific gap (prompt quality, an extra platform) blocks GHL work.

## Hard constraints

- GHL has no API to create or edit workflows. Never write code that assumes it can. Templates are pushed; workflow wiring is manual.
- Merge-field syntax is case-sensitive and fails silently. The generator must always emit a fallback on personalization fields (e.g. `{{contact.first_name || "there"}}`). See `references/flowmintv2ghl/ghl-api-reference.md`.
- Do not hardcode business data (phone, booking URL, company name) into template copy. Emit GHL Custom Values (`{{custom_values.key}}`) for stable business data.
- Auth model (reversed 2026-05-28): **CRAWL ships on Private Integration Tokens (PIT)** — the user pastes a GHL PIT, stored in `ghl_connections` (`auth_type='pit'`, null refresh/expiry). The private-OAuth-app path (install/callback routes + `lib/ghl`) is built and on-shelf for RUN, not the active path; do not delete it. Both are handled by `ghlFetch`. Earlier "locked: OAuth, never write PIT code" guidance is superseded — see COORDINATION.md "AUTH MODEL REVERSED".

## Brand voice (applies to all generated copy, docs, and user-facing text)

- No em dashes. Ever. Use a comma, a period, or a rewrite.
- Active voice.
- No consultant-speak. Plain, direct language.
- "Collaborator, not consultant" framing.
- "Human in the loop" is a load-bearing phrase, use it deliberately.

---

## Compact policy

When summarizing this conversation during /compact:
- Preserve all GHL API decisions and their rationale.
- Preserve the OAuth-vs-token decision status and any reasoning.
- Preserve any AI eval results (latency numbers, prompt versions, what was tried).
- Keep error causes and their solutions in detail.
- Maintain the list of modified files.
- Summarize exploration attempts briefly.
- Always re-read PRODUCT_BRIEF.md, plan.md, and COORDINATION.md after a compaction to re-anchor.

## Current state

**Single source of truth for work + status is `references/flowmintv2ghl/plan.md` (the living roadmap). Cross-session decisions + handoff live in `COORDINATION.md`. Do not keep a competing checklist here** — this section is a one-paragraph pointer only.

As of 2026-05-30: CRAWL is shipped and live on flowmint.me — analyze → generate (GHL-default, correct merge fields) → preview the first email → connect GHL via PIT (just-in-time modal, live token test) → push into a FlowMint folder with re-push dedup + "Synced to GHL" status. Per-call perf metrics persist to Supabase (migration-007). Demo recorded for Reed; Reed + Josh testing. See plan.md for done-vs-parked and COORDINATION.md for decisions.
