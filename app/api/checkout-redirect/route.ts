/**
 * API Route: Checkout Redirect
 * After signup, redirects authenticated user to Stripe checkout for their selected plan
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getStripe, PLANS, type PlanId } from "@/app/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const planId = request.nextUrl.searchParams.get("plan") as PlanId | null;

  if (!planId || !PLANS[planId]) {
    return NextResponse.redirect(new URL("/#pricing", request.url));
  }

  // Check auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(`/signup?plan=${planId}&redirectTo=/api/checkout-redirect?plan=${planId}`, request.url)
    );
  }

  // Create Stripe checkout session
  try {
    const stripe = getStripe();
    const plan = PLANS[planId];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `FlowMint ${plan.name}`,
              description: plan.description,
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        planId: planId,
        userEmail: user.email || "",
      },
      success_url: `${request.nextUrl.origin}/dashboard?purchased=${planId}`,
      cancel_url: `${request.nextUrl.origin}/#pricing`,
      customer_email: user.email || undefined,
    });

    if (session.url) {
      return NextResponse.redirect(session.url);
    }

    return NextResponse.redirect(new URL("/#pricing", request.url));
  } catch (error: any) {
    console.error("Checkout redirect error:", error);
    return NextResponse.redirect(new URL("/#pricing", request.url));
  }
}
