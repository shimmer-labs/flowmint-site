---
name: ghl-merge-field-generator
description: Use when generating any GHL email template content that contains dynamic/personalized text. Encodes the merge-field syntax rules so generated templates render correctly in GHL instead of failing silently.
---

# GHL Merge Field Generator

Apply these rules whenever generating template copy that includes dynamic fields. Merge fields fail silently in GHL, so getting this exactly right is the difference between a working template and one that sends "Hi ," to a real contact.

## Rules

1. Double curly braces: `{{contact.first_name}}`.
2. Case-sensitive. Lowercase field paths. `{{contact.name}}` works, `{{Contact.Name}}` does not.
3. Underscores, not spaces, in field keys.
4. ALWAYS emit a fallback on personalization fields using the double-pipe operator: `{{contact.first_name || "there"}}`. No exceptions. Blank-value sends are the top failure mode.
5. Use Custom Values for stable business data: `{{custom_values.booking_url}}`, `{{custom_values.company_name}}`. Never hardcode a phone number, booking link, or company name into copy.
6. Use Custom Fields (`{{contact.custom.field_key}}`) only for genuinely per-contact data.
7. Email may use Liquid filters; SMS may not. If generating SMS, use only the `||` fallback, no Liquid.
8. No em dashes anywhere in generated copy (brand voice).

## Field families to support first

- Contact: `first_name`, `last_name`, `email`, `phone`, `full_name`
- Custom Values: `{{custom_values.key}}`
- Custom Fields: `{{contact.custom.key}}`
- Appointment: `{{appointment.start_date_time}}`
- Attribution/UTM: `{{contact.attributionSource.utmSource}}` etc.

## Self-check before output

- Every personalization field has a fallback?
- All field paths lowercase and underscore-style?
- Stable business data expressed as Custom Values, not hardcoded?
- Zero em dashes?

Full reference: `references/flowmintv2ghl/ghl-api-reference.md`.
