# GHL API Reference (curated for FlowMint x GHL)

Source of truth for what the GHL V2 API can and cannot do. Curated, not dumped. If a question is not answered here, do not guess GHL behavior, flag that it needs checking against the official docs at https://marketplace.gohighlevel.com/docs.

Verified against GHL API V2 docs, May 2026. V1 reached end-of-support December 31, 2025; build only against V2.

---

## Can / Cannot

### CAN do via V2 API

Email templates (full CRUD) — verified endpoint shapes:
- **Create:** `POST https://services.leadconnectorhq.com/emails/public/v2/locations/{locationId}/templates`
  - Headers: `Version: 2023-02-21` (NOT the usual `2021-07-28`), `Authorization: Bearer <token>`
  - Body: `{ name, editorType: "html"|"builder"|"text", editorContent: <html>, subjectLine, previewText, fromName?, fromEmail?, parentFolderId?, userId? }`
  - Response: `{ id, name, editorType, isPlainText, subjectLine, previewText, previewUrl, createdAt, updatedAt, traceId }`
  - The `previewUrl` in the response is a Firebase-hosted index.html with the rendered template. Fetch it to verify our HTML actually landed (silent-acceptance check).
  - **Do NOT use `POST /emails/builder`** — it returns 201 but silently drops the payload and creates a starter template with GHL's default content. Distinct endpoint, same family name, completely different behaviour.
- List templates by location (separate endpoint, requires `emails/builder.readonly` scope)
- Update a template
- Delete a template
- Import a template from a provider URL
- **Create template folder** (verified 2026-05-28):
  - `POST https://services.leadconnectorhq.com/emails/public/v2/locations/{locationId}/templates/folders`
  - Headers: `Version: 2023-02-21`
  - Body: `{ name, userId? }`
  - Response: `{ id, name, updatedAt, traceId }`
  - On template create, include `parentFolderId: <folder.id>` to drop the template into that folder.
  - **No public list-folders endpoint** exists in the V2 docs — can't dedupe on name alone. Cache folder IDs in our DB after creating.

Email campaigns (V2, full lifecycle):
- Create, update, delete a campaign
- Schedule a campaign, including batch scheduling
- Read campaign and template statistics (opens, clicks, send data)

Other relevant surfaces:
- Contacts: create, update, retrieve
- Custom Fields V2 and Custom Values: manage the data that merge fields pull from
- Conversations: emails sent via the V2 Email API appear in the contact's conversation thread
- Calendars, appointments
- Send transactional/programmatic email via the V2 Email API
- Read a workflow (GET get-workflow) to discover what already exists in a location
- Trigger automations indirectly via Inbound Webhook triggers (an external event fires a GHL workflow that the user built)

### CANNOT do via API

- Create a workflow
- Edit a workflow, or add/modify/reorder workflow steps
- Build automation logic: branches, wait steps, triggers, conditions
- Select a template into a workflow step (this selection is manual in the GHL UI)
- Deploy or update funnels / webpages

The entire Workflows API is a single read-only endpoint (Get Workflow). Creating and editing workflows via API is a long-standing, heavily-requested gap on the GHL ideas board, still open as of this writing. Do not design around the assumption it will land.

---

## The product seam (why this shapes everything)

FlowMint authors and pushes templates. A human wires them into a workflow inside GHL. The API does the tedious part (authoring, syncing, organizing, reporting); the human does the one thing the API will not allow a machine to do (build the automation).

This is the human-in-the-loop seam. It is the product, not a workaround.

---

## Merge-field syntax (the generator must get this exactly right)

Merge fields fail silently. Wrong syntax or a missing value yields blank text or literal curly braces in the sent message. The two most common failures are a wrong-case field and a missing-value field with no fallback.

Core rules:
- Double curly braces: `{{contact.first_name}}`
- Case-sensitive: `{{contact.name}}` works, `{{Contact.Name}}` does not.
- Field keys use underscores, not spaces: `{{contact.first_name}}`
- Fallbacks use the double-pipe operator: `{{contact.first_name || "there"}}`. Shows the value if present, else the fallback.
- GENERATOR RULE: always emit a fallback on any personalization field. Blank-name sends are the number one failure mode.
- Email supports Liquid filter syntax (e.g. `| default: "there"`). SMS does NOT. If the generator ever emits SMS, it must avoid Liquid filters and rely on the `||` fallback only.

Field families (support these first):
- Contact: `{{contact.first_name}}`, `{{contact.last_name}}`, `{{contact.email}}`, `{{contact.phone}}`, `{{contact.full_name}}`
- Custom Values (reusable business-level placeholders): `{{custom_values.key_name}}`
- Custom Fields (per-contact custom data): `{{contact.custom.field_key}}` style
- Appointment (reminders, follow-ups): `{{appointment.start_date_time}}`
- Location / sub-account: sub-account-level info
- Attribution / UTM (useful for referral tracking): `{{contact.attributionSource.utmSource}}`, `.campaign`, `.url`, `.utmMedium`, etc.

### Custom Fields vs Custom Values (the most-missed concept)

- Custom Fields are per-contact: birthdays, preferences, anything unique to one contact.
- Custom Values are reusable placeholders for consistent info across all messages: company name, booking URL, office phone, standard offer name.
- The classic mistake is hardcoding stable business data (a phone number, a booking link) into template copy. When it changes, every template must be hand-edited.
- GENERATOR RULE: emit `{{custom_values.key}}` for stable business data so a single update propagates everywhere. Only hardcode truly static text.

---

## Authentication

- V2 uses OAuth 2.0 (Bearer / JWT) or a Private Integration Token.
- Access is scoped to Location level (sub-account) or Agency level (company).
- For the Workflows and Templates endpoints, use a Sub-Account access token or Private Integration Token of the sub-account.

Open decision for our build: per-location Private Integration Token (simplest for CRAWL) vs OAuth app (required for the marketplace at RUN). Building on the OAuth model from the start avoids a later token-to-OAuth rewrite. Tracked in COORDINATION.md.

---

## Marketplace path (for RUN phase only)

Do not build for this yet. Captured so the CRAWL architecture does not paint us into a corner.

- Requires a Marketplace Developer Account via the Developer Portal. One Owner per developer account.
- Apps use OAuth 2.0 with Location-level or Agency-level access.
- All public apps must pass a HighLevel marketplace review before customers can install. Review takes up to 10 business days. Disapprovals come back with requested changes; you fix and resubmit.
- Private-app gotcha: when a private app reaches 6 or more agencies, new installs are blocked until you either publish it as Public or pass a Security Review. So we can stay private through WALK, but RUN forces the public listing plus review.
- Submission needs: a functioning integration, a clear agency-facing value proposition, brand assets (logo, name, short and long description), and at least one support channel (email or support portal).

Backward constraint on CRAWL: if marketplace is the eventual goal, favor the OAuth app model early so we do not rewrite auth later.
