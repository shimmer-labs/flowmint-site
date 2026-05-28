---
name: ghl-template-push
description: Use when pushing a generated email template into a GHL location via the V2 API. Encodes the endpoint, auth, and the human-wiring handoff so the agent does not try to do things the API cannot.
---

# GHL Template Push

The procedure for getting a generated template into a client's GHL location. Verify specifics against `references/flowmintv2ghl/ghl-api-reference.md` before coding; this skill is the shape, the reference is the detail.

## What this does and does not do

- DOES: create / update / organize email templates in a GHL location via the V2 API.
- DOES NOT: wire the template into a workflow. The GHL API cannot create or edit workflows. After the push, a human selects the template into a workflow step inside GHL. Always surface this handoff explicitly to the user; do not silently assume the template is "live."

## Procedure

1. Confirm auth. We are using a **private OAuth app** (decision locked, see `references/flowmintv2ghl/COORDINATION.md`). Each location has its own access/refresh token pair stored in Supabase. Refresh-on-401. Never hardcode credentials.
2. Validate the template content against the `ghl-merge-field-generator` rules before pushing. A push of a silently-broken template is worse than no push.
3. Call the create-email-template-v2 endpoint (or update if the template already exists) scoped to the target location. Verify endpoint and payload shape against `references/flowmintv2ghl/ghl-api-reference.md`.
4. On success, report back to the user: the template ID/location, and the explicit next manual step (wire it into the workflow step in GHL).
5. If testing, push to a test location only. Never push to a real client location without explicit confirmation.

## Guardrails

- No workflow-creation calls. They do not exist.
- Do not push to a real client location without explicit user go-ahead.
- Surface the human-wiring handoff every time. It is the human-in-the-loop seam.
