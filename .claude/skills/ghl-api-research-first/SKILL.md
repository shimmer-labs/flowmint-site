---
name: ghl-api-research-first
description: Use ANY time about to write, modify, or debug code that calls a GoHighLevel V2 API endpoint (services.leadconnectorhq.com/...). GHL's API returns 201 for create calls even when it silently drops unknown fields, so a "successful" response does NOT mean the payload was accepted as intended. This skill enforces a verify-the-shape-first rule before more code lands.
---

# GHL API Research First

When about to write or change code that calls a GHL V2 endpoint, **stop and verify the request shape against either real docs or real round-trip output before writing the call**. Do not pattern-match from common REST conventions; GHL deviates.

## The class of failure this skill prevents

GHL accepts requests with unknown body fields and returns `201 Created` without complaining. The created resource is then populated with defaults instead of the data you sent. The 201 looks like success. The resource in the UI is empty / default content. You discover this only after the user looks at the actual GHL UI and tells you it didn't work.

This has burned multiple cycles on the FlowMint integration already (`emails/builder` create-template; possibly others). Each cycle costs the user real time and trust.

## Hard rules

1. **Never trust a 2xx response alone.** Until the resulting resource is verified in the GHL UI (or via a separate read endpoint we know works), the create call is not "done."
2. **Before adding or changing a field in a GHL API call**, do one of:
   - **Find it in the live docs.** Navigate to `https://marketplace.gohighlevel.com/docs/` (Docusaurus, JS-rendered — use Playwright, not WebFetch). Look up the specific endpoint's request body schema. If the docs page is hard to find, surface that to the user before guessing.
   - **Or surface the unknown to the user.** Say "I don't know the exact field name for X; here are the candidates and the way to verify." Don't write speculative code that you can't validate.
3. **When probing field shapes empirically**, do it ONCE with multiple side-by-side candidates and ask the user to look at the GHL UI to confirm which (if any) actually stuck. Don't iterate one-at-a-time; you'll burn the user's patience.
4. **If no candidate works**, the endpoint or `type` value is probably wrong. Surface that as an architectural question (different endpoint? import-from-URL flow?) before writing more push code.

## What "verify" looks like in practice

- For create endpoints: the user opens the created resource in the GHL UI and confirms our payload is there. Visible content is the only authoritative signal.
- For read endpoints: the response body must contain the field we expect, with the value we sent.
- For state-changing endpoints (update/delete): re-fetch and confirm the change took.

## Curated GHL endpoint reference

See `references/flowmintv2ghl/ghl-api-reference.md`. As new endpoints are verified, append to that file with the request body shape, the response shape, and one line of verify-procedure ("look at X in GHL UI"). That file becomes the place future sessions look first.

## Relationship to the universal skill

A universal version of this discipline lives at `~/.claude/skills/third-party-api-research-first/`. That covers any third-party API in any project. This file is the GHL-specific overlay — apply both when working in this repo.

## Related skills + memories

- `third-party-api-research-first` (universal, in `~/.claude/skills/`) — the general "verify before trusting 2xx" rule.
- `ghl-merge-field-generator` — content rules for any generated email HTML.
- `ghl-template-push` — high-level push procedure (auth, handoff, guardrails).
- Memory `dont-guess-ghl-specifics` — root principle this skill operationalises.
- Memory `ghl-marketplace-apps-not-editable` — why iteration cost is high.
