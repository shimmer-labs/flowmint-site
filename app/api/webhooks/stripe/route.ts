import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/app/lib/stripe'
import { createAdminClient } from '@/app/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { userId, planId } = session.metadata || {}

    if (userId && planId) {
      try {
        const supabase = createAdminClient()

        // Update user's profile with purchased plan
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: session.customer_email || session.metadata?.userEmail || '',
            plan: planId,
            purchased_at: new Date().toISOString(),
            stripe_session_id: session.id,
          }, {
            onConflict: 'id',
          })

        if (error) {
          console.error('Failed to update profile:', error)
        } else {
          console.log(`Purchase activated: user=${userId}, plan=${planId}`)

          // Fire GA4 purchase event via Measurement Protocol
          const ga4Secret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET
          if (ga4Secret) {
            try {
              await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-25H25RV136&api_secret=${ga4Secret}`, {
                method: 'POST',
                body: JSON.stringify({
                  client_id: `server_${userId}`,
                  events: [{
                    name: 'purchase',
                    params: {
                      currency: 'USD',
                      value: planId === 'essentials' ? 49 : planId === 'complete' ? 99 : 149,
                      transaction_id: session.id,
                      items: JSON.stringify([{ item_name: `FlowMint ${planId}` }]),
                    }
                  }]
                })
              })
            } catch (e) {
              console.error('GA4 MP event failed:', e)
            }
          }
        }
      } catch (err) {
        console.error('Database error on webhook:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
