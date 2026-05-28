# Product Brief: FlowMint x GHL

Living brief. Re-read before any architectural decision. Update as scope firms up. This is the "why" and the scope guardrail; CLAUDE.md is the "how we work."

---

## One-liner

Extend the existing FlowMint codebase to add Go High Level as an integration: FlowMint generates on-brand, merge-field-correct email templates and pushes them into a client's GHL location via the V2 API. A human wires those templates into a GHL workflow by hand.

## Why this exists

Reed sells to GHL clients. A FlowMint-to-GHL add-on could be a seamless upsell into that existing pipeline. The bet: template generation and push is a real, deliverable slice of value even though GHL will not let us build the automation itself via API. Extending FlowMint in place gets us there fastest, since the generation engine already exists.

## The product shape (load-bearing)

- FlowMint authors and pushes templates. The API handles authoring, syncing, organizing, and reporting.
- The human wires templates into workflows inside GHL, because the GHL API has no create/edit workflow capability.
- This human-wiring step is the human-in-the-loop seam. It is the product, not a workaround. (See `references/flowmintv2ghl/ghl-api-reference.md` for the hard API limits.)

## Two workstreams

1. GHL integration: extend FlowMint's existing generation flow to push templates to GHL.
2. AI speed eval: measure and optimize how long the AI generation step takes, so the integration ships fast rather than slow. Both run together; see references/flowmintv2ghl/plan.md.

## What we know about feasibility

- Templates: full CRUD via API. Confirmed.
- Workflows / automations: read-only via API. Cannot create or edit. Confirmed.
- Merge-field syntax is well-documented and the generator can target it reliably. See `references/flowmintv2ghl/ghl-api-reference.md`.
- FlowMint already generates email content, so the GHL work is an extension, not a rebuild.

---

## Crawl / Walk / Run

### CRAWL (current phase)
Extend FlowMint to generate on-brand, merge-field-valid templates and push them to a client's GHL location. Client wires them into workflows manually. Baseline and optimize the AI generation speed. Validate with a pilot client or two. Auth: simplest path that does not block RUN (see open decision below). No marketplace.

Done when: a pilot client has FlowMint-generated templates living in their GHL location, wired into a working workflow, rendering correctly with real contact data, and the generation step runs at an acceptable speed (target set during the eval).

### WALK (not yet)
Multi-client plus campaign layer. Add campaign create/schedule, template folders, and pull statistics back for reporting. Possibly a thin UI for Reed. Still token-based per client, or a private OAuth app across a handful of locations.

### RUN (not yet, but it constrains CRAWL)
Marketplace app: public listing, OAuth, marketplace review (up to 10 business days), brand assets, support channel. Private apps get install-blocked at 6+ agencies, so RUN forces the public path. See `references/flowmintv2ghl/ghl-api-reference.md` marketplace section.

Backward constraint: if marketplace is the goal, favor the OAuth app model early to avoid a token-to-OAuth rewrite.

---

## Scope guardrails

- Build only CRAWL features now. Do not build WALK or RUN features unless this brief moves phases.
- No workflow-building code. The API cannot do it; the human does it.
- Every generated template must follow the merge-field generator rules (always emit fallbacks, use Custom Values for stable business data).
- Extend in place. Follow FlowMint's existing conventions; no unrequested refactors.

## Open decisions (resolve before heavy build)

1. Auth model: per-location Private Integration Token vs OAuth app. Recommendation on the table: OAuth early to protect the RUN path. Status in COORDINATION.md.
2. Distribution at RUN: marketplace app vs private OAuth app vs embedded. Shapes architecture more than the feature list does.

## Out of scope (for now)

- SMS template generation (possible later; if added, no Liquid filters, `||` fallbacks only).
- Funnel / webpage deployment (no API support anyway).
- Anything that assumes programmatic workflow creation.
