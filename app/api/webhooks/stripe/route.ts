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

  const supabase = createAdminClient()

  // --- checkout.session.completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const { userId, purchaseType, analysisId, flowId } = session.metadata || {}

    if (!userId || !purchaseType) {
      console.error('Missing metadata on checkout session:', session.id)
      return NextResponse.json({ received: true })
    }

    try {
      if (purchaseType === 'unlimited') {
        // Set profile to unlimited with 30-day expiry (renewed by invoice.paid)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 35) // 35 days buffer

        await supabase
          .from('profiles')
          .update({
            plan: 'unlimited',
            unlimited_expires_at: expiresAt.toISOString(),
            stripe_customer_id: session.customer || null,
          })
          .eq('id', userId)

        console.log(`Unlimited activated: user=${userId}`)
      } else {
        // Create purchase record for single_flow or full_campaign
        const purchaseData: any = {
          user_id: userId,
          stripe_session_id: session.id,
          purchase_type: purchaseType,
          status: 'active',
        }

        if (analysisId) purchaseData.analysis_id = analysisId
        if (flowId && purchaseType === 'single_flow') purchaseData.flow_id = flowId

        const { error } = await supabase
          .from('purchases')
          .insert(purchaseData)

        if (error) {
          console.error('Failed to create purchase:', error)
        } else {
          console.log(`Purchase created: user=${userId}, type=${purchaseType}, analysis=${analysisId}`)
        }
      }
    } catch (err) {
      console.error('Database error on webhook:', err)
    }
  }

  // --- customer.subscription.deleted ---
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as any
    const customerId = subscription.customer

    try {
      // Find user by stripe_customer_id and revoke unlimited
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            plan: 'free',
            unlimited_expires_at: null,
          })
          .eq('id', profile.id)

        console.log(`Unlimited revoked: user=${profile.id}, customer=${customerId}`)
      }
    } catch (err) {
      console.error('Error revoking unlimited:', err)
    }
  }

  // --- invoice.paid ---
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as any
    const customerId = invoice.customer

    // Only handle subscription invoices (not one-time)
    if (!invoice.subscription) {
      return NextResponse.json({ received: true })
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 35) // 35 days buffer

        await supabase
          .from('profiles')
          .update({
            plan: 'unlimited',
            unlimited_expires_at: expiresAt.toISOString(),
          })
          .eq('id', profile.id)

        console.log(`Unlimited renewed: user=${profile.id}`)
      }
    } catch (err) {
      console.error('Error extending unlimited:', err)
    }
  }

  return NextResponse.json({ received: true })
}
