import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
    _stripe = new Stripe(key)
  }
  return _stripe
}

/**
 * FlowMint pricing tiers — one-time purchases
 */
export const PLANS = {
  essentials: {
    id: 'essentials',
    name: 'Essentials',
    price: 4900, // cents
    description: 'Welcome, Cart Abandonment, Post-Purchase flows',
    allowedFlows: ['welcome', 'cart-abandonment', 'post-purchase-onboarding'],
  },
  complete: {
    id: 'complete',
    name: 'Complete',
    price: 9900,
    description: 'All 18+ flows + AI Template Editing',
    allowedFlows: null, // all flows
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 14900,
    description: 'Everything + Campaign Calendar + Priority Support',
    allowedFlows: null,
  },
} as const

export type PlanId = keyof typeof PLANS
