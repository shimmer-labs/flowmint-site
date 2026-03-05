/**
 * One-time script: Create FlowMint products and prices in Stripe
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-stripe-products.ts
 *
 * This creates 3 products with one-time prices and outputs the price IDs
 * to paste into app/lib/stripe.ts
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY env var');
  process.exit(1);
}

const stripe = new Stripe(key);

const products = [
  {
    name: 'FlowMint Essentials',
    description: 'Export Welcome, Cart Abandonment, and Post-Purchase flows. Push to all platforms. Email support.',
    price: 4900, // $49
    planId: 'essentials',
  },
  {
    name: 'FlowMint Complete',
    description: 'Export ALL 18+ flows. AI Template Editing. Push to all platforms.',
    price: 9900, // $99
    planId: 'complete',
  },
  {
    name: 'FlowMint Premium',
    description: 'Everything in Complete plus Campaign Calendar, priority support, and early access to new features.',
    price: 14900, // $149
    planId: 'premium',
  },
];

async function main() {
  console.log('Creating FlowMint products in Stripe...\n');

  const results: Record<string, string> = {};

  for (const p of products) {
    const product = await stripe.products.create({
      name: p.name,
      description: p.description,
      metadata: { planId: p.planId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.price,
      currency: 'usd',
    });

    results[p.planId] = price.id;
    console.log(`✓ ${p.name} — Product: ${product.id}, Price: ${price.id}`);
  }

  console.log('\n--- Copy these into app/lib/stripe.ts ---\n');
  console.log(`essentials: { ...PLANS.essentials, stripePriceId: '${results.essentials}' },`);
  console.log(`complete:   { ...PLANS.complete, stripePriceId: '${results.complete}' },`);
  console.log(`premium:    { ...PLANS.premium, stripePriceId: '${results.premium}' },`);
  console.log('\nDone!');
}

main().catch(console.error);
