/**
 * API Route: Checkout Redirect
 * After signup, redirects authenticated user to Stripe checkout for their selected product
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getStripe, PRODUCTS, type ProductId } from "@/app/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const purchaseType = request.nextUrl.searchParams.get("purchaseType") as ProductId | null;
  const analysisId = request.nextUrl.searchParams.get("analysisId");
  const flowId = request.nextUrl.searchParams.get("flowId");

  if (!purchaseType || !PRODUCTS[purchaseType]) {
    return NextResponse.redirect(new URL("/#pricing", request.url));
  }

  // Check auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const params = new URLSearchParams({
      purchaseType,
      ...(analysisId && { analysisId }),
      ...(flowId && { flowId }),
    });
    return NextResponse.redirect(
      new URL(`/signup?redirectTo=/api/checkout-redirect?${params.toString()}`, request.url)
    );
  }

  // Create Stripe checkout session
  try {
    const stripe = getStripe();
    const product = PRODUCTS[purchaseType];

    const sessionParams: any = {
      mode: product.mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: product.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        purchaseType,
        analysisId: analysisId || "",
        flowId: flowId || "",
        userEmail: user.email || "",
      },
      success_url: `${request.nextUrl.origin}/templates?purchased=${purchaseType}`,
      cancel_url: `${request.nextUrl.origin}/#pricing`,
      customer_email: user.email || undefined,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (session.url) {
      return NextResponse.redirect(session.url);
    }

    return NextResponse.redirect(new URL("/#pricing", request.url));
  } catch (error: any) {
    console.error("Checkout redirect error:", error);
    return NextResponse.redirect(new URL("/#pricing", request.url));
  }
}
