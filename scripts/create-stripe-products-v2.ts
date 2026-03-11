/**
 * One-time script: Create FlowMint v2 credit-based products in Stripe
 * Also archives the old one-time purchase products.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-stripe-products-v2.ts
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY env var');
  process.exit(1);
}

const stripe = new Stripe(key);

// Old product IDs to archive
const OLD_PRODUCT_IDS = [
  'prod_U5vwOlQIBIhgow',
  'prod_U5vwetcpSoTwtu',
  'prod_U5vwMe55y7hTOX',
];

const NEW_PRODUCTS = [
  {
    name: 'FlowMint Single Flow',
    description: 'Export one flow for one brand analysis. Pay once.',
    unitAmount: 2900, // $29
    planId: 'single_flow',
    mode: 'payment' as const,
  },
  {
    name: 'FlowMint Full Campaign',
    description: 'Export ALL flows for one brand analysis. Pay once.',
    unitAmount: 7900, // $79
    planId: 'full_campaign',
    mode: 'payment' as const,
  },
  {
    name: 'FlowMint Unlimited',
    description: 'Unlimited brands, exports, campaign calendar. Monthly subscription.',
    unitAmount: 14900, // $149/mo
    planId: 'unlimited',
    mode: 'subscription' as const,
  },
];

async function main() {
  // Archive old products
  console.log('Archiving old products...\n');
  for (const id of OLD_PRODUCT_IDS) {
    try {
      await stripe.products.update(id, { active: false });
      console.log(`  Archived: ${id}`);
    } catch (err: any) {
      console.log(`  Skip ${id}: ${err.message}`);
    }
  }

  // Create new products
  console.log('\nCreating new products...\n');
  const results: Record<string, { productId: string; priceId: string }> = {};

  for (const p of NEW_PRODUCTS) {
    const product = await stripe.products.create({
      name: p.name,
      description: p.description,
      metadata: { planId: p.planId },
    });

    const priceParams: Stripe.PriceCreateParams = {
      product: product.id,
      unit_amount: p.unitAmount,
      currency: 'usd',
    };

    if (p.mode === 'subscription') {
      priceParams.recurring = { interval: 'month' };
    }

    const price = await stripe.prices.create(priceParams);

    results[p.planId] = { productId: product.id, priceId: price.id };
    console.log(`  ${p.name} — Product: ${product.id}, Price: ${price.id}`);
  }

  console.log('\n--- Copy these into app/lib/stripe.ts PRODUCTS ---\n');
  console.log(`single_flow:   { stripePriceId: '${results.single_flow.priceId}' },`);
  console.log(`full_campaign: { stripePriceId: '${results.full_campaign.priceId}' },`);
  console.log(`unlimited:     { stripePriceId: '${results.unlimited.priceId}' },`);
  console.log('\nDone!');
}

main().catch(console.error);
