# CLAUDE.md — FlowMint Web App (flowmint.me)

This file provides guidance to Claude Code when working with the FlowMint web app.

## Project Overview

FlowMint is an AI email marketing tool. Enter any website URL → get brand analysis → generate personalized email campaigns → export or push to your email platform. No Shopify required.

**Live at:** flowmint.me
**Repo:** `~/flowmint-site/`
**Hosting:** Vercel
**Database:** Supabase (PostgreSQL)
**Payments:** Stripe

**Tech Stack:**
- Next.js 15 (App Router)
- TypeScript + Tailwind CSS
- Supabase Auth + PostgreSQL
- Stripe Checkout + Webhooks
- Anthropic Claude (Sonnet 4) for AI generation
- Deployed on Vercel

**Target Market:**
Small business owners with any website (Shopify, WooCommerce, Squarespace, custom) who need email marketing flows but lack time/expertise.

---

## Pricing — Credit-Based Model (March 2026)

**Pivoted from flat one-time purchases ($49/$99/$149) to per-brand credits.**

| Tier | Price | Type | What You Get |
|------|-------|------|-------------|
| Free | $0 | — | Unlimited analysis + generation + preview. Can't export/push. |
| Single Flow | $29 | One-time | Export 1 flow for 1 brand analysis |
| Full Campaign | $79 | One-time | Export ALL 18+ flows for 1 brand analysis |
| Unlimited | $149/mo | Subscription | Unlimited brands, exports, campaign calendar, priority support |

**Key rules:**
- Single Flow and Full Campaign credits are locked to one `analysis_id` (one brand URL)
- Free users can analyze + generate + preview unlimited times — paywall is on export/push only
- AI template editing unlocked by any purchase (not tier-gated)
- Campaign calendar is Unlimited only
- Each brand requires a separate purchase (or Unlimited subscription)

**Stripe Products:**
- Single Flow: `price_1T7m0w0rJcMXVHwsykcLH9cj`
- Full Campaign: `price_1T7m0x0rJcMXVHws9quD9tWQ`
- Unlimited: `price_1T7m0x0rJcMXVHwsvOgAFH02`

---

## Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
```

---

## Architecture

### Route Structure (Next.js App Router)

**Pages:**
- `app/page.tsx` — Homepage (hero + URL input + pricing + FAQ)
- `app/login/page.tsx` — Login
- `app/signup/page.tsx` — Signup (supports `?redirectTo=` for post-auth checkout)
- `app/dashboard/page.tsx` — User dashboard (analysis history + purchase badges)
- `app/results/page.tsx` — Analysis results + flow generation + purchase CTAs
- `app/templates/page.tsx` — Template library with inline purchase modals
- `app/settings/page.tsx` — Account, purchases, platform config
- `app/privacy/page.tsx` — Privacy policy
- `app/terms/page.tsx` — Terms of service
- `app/support/page.tsx` — Support page

**API Routes:**
- `app/api/analyze/route.ts` — Brand analysis (web scraping + Claude)
- `app/api/generate-all/route.ts` — Generate all flows for an analysis
- `app/api/generate-flow/route.ts` — Generate single flow
- `app/api/generate-email/route.ts` — Generate single email
- `app/api/generation-status/route.ts` — Poll generation progress
- `app/api/checkout/route.ts` — Create Stripe checkout session
- `app/api/checkout-redirect/route.ts` — Post-signup checkout redirect
- `app/api/billing-portal/route.ts` — Stripe billing portal for Unlimited subscribers
- `app/api/webhooks/stripe/route.ts` — Stripe webhook handler
- `app/api/export/route.ts` — Export templates (purchase-gated)
- `app/api/push-to-platform/route.ts` — Push to email platform (purchase-gated)
- `app/api/ai-edit/route.ts` — AI template editing (any purchase)
- `app/api/settings/route.ts` — Save platform + API key settings

### Core Libraries

- `app/lib/stripe.ts` — Stripe client, PRODUCTS config, Purchase type
- `app/lib/plan-gating.ts` — Server-side async purchase checks (canExportFlow, canExportAll, canAIEdit, hasUnlimitedAccess, etc.)
- `app/lib/plan-gating-client.ts` — Client-side sync helpers (operate on pre-fetched Purchase arrays)
- `app/lib/supabase/` — Supabase client (server + browser)
- `app/lib/auth/` — Auth helpers
- `app/contexts/AuthContext.tsx` — Client-side auth context

### Database Schema (Supabase)

**Key tables:**
- `profiles` — User profiles (plan, stripe_customer_id, unlimited_expires_at, legacy_plan)
- `purchases` — Credit purchases (purchase_type, analysis_id, flow_id, status, exported_at)
- `analyses` — Brand analysis results (cached per URL)
- `email_templates` — Generated email templates
- `generation_jobs` — Async generation job tracking
- `user_settings` — Platform selection + encrypted API keys

**Purchase constraints:**
- Unique: one `single_flow` per user + analysis + flow
- Unique: one `full_campaign` per user + analysis
- RLS: users read own, service role full access

### Checkout Flow

1. User clicks pricing CTA on homepage or inline purchase modal on templates page
2. For Single Flow / Full Campaign: must have an `analysisId` first (analyze → generate → buy)
3. For Unlimited: direct to Stripe Checkout (subscription mode)
4. Stripe webhook creates purchase record or sets unlimited status
5. User redirected back to templates page with `?purchased=` toast

### Webhook Events Handled

- `checkout.session.completed` → Create purchase record OR set profile to unlimited (35-day expiry)
- `customer.subscription.deleted` → Revoke unlimited, set plan to 'free'
- `invoice.paid` → Extend unlimited_expires_at by 35 days

---

## Features

### What's Live
- [x] Brand analysis (any website — scrapes content, analyzes voice/colors/products)
- [x] 18+ email flow types with AI generation
- [x] Multi-platform syntax (Klaviyo, Mailchimp, ActiveCampaign, GetResponse, Customer.io, OmniSend, Shopify Email)
- [x] Export ZIP with templates
- [x] Platform API push (Klaviyo + others)
- [x] AI template editing (Claude-powered)
- [x] Credit-based billing via Stripe ($29/$79/$149)
- [x] Free tier: unlimited analysis + generation + preview
- [x] Inline purchase modals on templates page
- [x] Purchase badges on dashboard analysis cards
- [x] Stripe billing portal for Unlimited subscribers
- [x] Supabase auth (email/password)
- [x] Mobile responsive

### Homepage UX (Updated March 2026)
- Hero: URL input + "Analyze My Brand" CTA + trust signals
- How It Works: 3-step visual (Enter URL → AI Analyzes → Get Campaigns)
- Pricing: "Simple Pricing. Pay When You're Ready." + free tier banner + 3 cards
- FAQ: 6 questions covering credit system, multiple brands, platforms
- CTA buttons: "Get Started Free →" (scrolls to URL input) for one-time tiers, "Subscribe — $149/mo" for unlimited

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Email Platform APIs (optional per platform)
KLAVIYO_API_KEY=
```

---

## Relationship to Shopify App

This web app (`~/flowmint-site/`) is a standalone product separate from the Shopify app (`~/flowmint/`). They share the FlowMint brand and similar features but have different:
- Tech stacks (Next.js vs React Router)
- Databases (Supabase vs SQLite/Prisma)
- Payment systems (Stripe vs Shopify Billing API)
- Pricing models (credit-based vs flat tiers)
- Hosting (Vercel vs Fly.io)

The Shopify app is in maintenance mode. The web app is the primary growth product.

---

# currentDate
Today's date is 2026-03-05.
