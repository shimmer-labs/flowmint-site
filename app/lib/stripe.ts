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
 * FlowMint v2 — credit-based products
 */
export const PRODUCTS = {
  single_flow: {
    id: 'single_flow',
    name: 'Single Flow',
    price: 2900, // $29
    stripePriceId: 'price_1T9bdS0rJcMXVHwsR6A5kbm5',
    mode: 'payment' as const,
    description: 'Export one flow for one brand analysis',
  },
  full_campaign: {
    id: 'full_campaign',
    name: 'Full Campaign',
    price: 7900, // $79
    stripePriceId: 'price_1T9bdT0rJcMXVHwsgOukTjoX',
    mode: 'payment' as const,
    description: 'Export ALL flows for one brand analysis',
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    price: 14900, // $149/mo
    stripePriceId: 'price_1T9bdT0rJcMXVHwsRBgD7g5Z',
    mode: 'subscription' as const,
    description: 'Unlimited brands, exports, and campaign calendar',
  },
} as const

export type ProductId = keyof typeof PRODUCTS

export interface Purchase {
  id: string
  user_id: string
  stripe_session_id: string | null
  stripe_subscription_id: string | null
  purchase_type: ProductId
  analysis_id: string | null
  flow_id: string | null
  status: string
  exported_at: string | null
  created_at: string
}
