# GHL marketplace preview images

All shots are 960x540 PNG (top of GHL's 640x360–960x540 allowed range). Captured from production flowmint.me on 2026-05-28.

## Recommended upload order (5 shots, strongest first)

1. **`01-homepage-hero.png`** — value prop + URL input. The "what is this thing" shot.
2. **`08-templates-expanded.png`** — real generated email subjects/preheaders for ShimmerLabs. The "wait, it actually does the thing" shot. Strongest piece of social proof in the set.
3. **`06-flow-recommendations.png`** — "Generate 8 Emails" CTA + business-model classification. Shows the magic moment after analysis.
4. **`02-how-it-works.png`** — 3-step explainer. Cheap-and-clear for skimmers.
5. **`03-pricing.png`** — credit-based pricing + free tier callout. Reduces "is this expensive?" friction.

## Alternates / drop-ins

- **`05-results-top.png`** — brand analysis confirmation banner + platform picker. Good detail shot if GHL lets us upload more than 5.
- **`04-dashboard.png`** — logged-in dashboard with stats. Useful for showing "you'll have a real account." Less compelling than the templates shot.
- **`07-templates.png`** — collapsed templates list. Mostly redundant with `08`; use only as alternate.

## Notes on shot content

- The ShimmerLabs example in `06` and `08` shows real generated emails for a custom-software-development-agency. Good fit for GHL's agency audience (they see another agency using it for itself).
- One known em-dash in the homepage hero copy: "Works with any site — Shopify, WooCommerce, Squarespace, or custom." Visible in `01`. Brand voice rule says no em dashes; parked as a future cleanup, not a blocker for marketplace submission.
- Sidebar scrollbars in some shots (`05`, `07`, `08`) are visible because Firefox / the test viewport. Not a quality issue, but if GHL bounces a screenshot for "scrollbar visible" we can re-capture with `overflow: hidden` injected via a Playwright stylesheet.

## Re-shoot instructions (if needed)

1. `npx playwright install` if Playwright isn't set up.
2. Resize browser to 960x540 viewport (NOT full-page screenshots — use viewport-only so output is exactly 960x540).
3. Capture sequence: homepage hero → scroll to how-it-works (y=700) → scroll to pricing (y=1500) → log in → dashboard → click "View Results" on an existing analysis → results-top → scroll 800px → flow-recommendations → /templates → click a flow to expand → scroll ~380px to frame the expanded section cleanly.
