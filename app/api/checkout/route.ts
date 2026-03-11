import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { getStripe, PRODUCTS, type ProductId } from '@/app/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { purchaseType, analysisId, flowId } = await request.json()

    if (!purchaseType || !(purchaseType in PRODUCTS)) {
      return NextResponse.json({ error: 'Invalid purchase type' }, { status: 400 })
    }

    // Validate required params based on purchase type
    if (purchaseType === 'single_flow' && (!analysisId || !flowId)) {
      return NextResponse.json({ error: 'analysisId and flowId required for single flow' }, { status: 400 })
    }
    if (purchaseType === 'full_campaign' && !analysisId) {
      return NextResponse.json({ error: 'analysisId required for full campaign' }, { status: 400 })
    }

    const product = PRODUCTS[purchaseType as ProductId]
    const stripe = getStripe()

    const sessionParams: any = {
      mode: product.mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: product.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        purchaseType,
        analysisId: analysisId || '',
        flowId: flowId || '',
        userEmail: user.email || '',
      },
      customer_email: user.email || undefined,
      success_url: `${request.nextUrl.origin}/templates?purchased=${purchaseType}`,
      cancel_url: `${request.nextUrl.origin}/#pricing`,
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
