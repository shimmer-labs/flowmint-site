# FlowMint Web App

AI-powered email marketing — enter any website URL, get personalized email campaigns in minutes.

**Live:** [flowmint.me](https://flowmint.me)

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Stripe (Checkout + Webhooks)
- Anthropic Claude (Sonnet 4) for AI generation
- Deployed on Vercel

## Pricing

| Tier | Price | What You Get |
|------|-------|-------------|
| Free | $0 | Unlimited analysis + generation + preview |
| Single Flow | $29 | Export 1 flow for 1 brand |
| Full Campaign | $79 | Export ALL 18+ flows for 1 brand |
| Unlimited | $149/mo | Unlimited brands, exports, campaign calendar |

## Development

```bash
npm install
npm run dev      # localhost:3000
npm run build    # production build
```

## Docs

See [CLAUDE.md](./CLAUDE.md) for full technical documentation.
