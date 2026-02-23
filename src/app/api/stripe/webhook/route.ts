import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { PLAN_LIMITS } from '@/types/events'
import type { EventsPlan } from '@/types/events'
import Stripe from 'stripe'

export const runtime = 'nodejs'

// In Stripe SDK v20+, period dates are on subscription items, not the subscription itself
function getSubscriptionPeriod(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0]
  if (item) {
    return {
      start: new Date(item.current_period_start * 1000).toISOString(),
      end: new Date(item.current_period_end * 1000).toISOString(),
    }
  }
  // Fallback: use current time + 30 days
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + 30)
  return { start: now.toISOString(), end: end.toISOString() }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = await getDb()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.organizationId
        const plan = (session.metadata?.plan || 'grassroots') as EventsPlan
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        if (!orgId) {
          console.error('[stripe/webhook] No organizationId in checkout metadata')
          break
        }

        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.grassroots

        // Fetch subscription details for period dates
        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const period = getSubscriptionPeriod(sub)

        await db.query(`
          INSERT INTO product_subscriptions (id, organization_id, product, plan, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, limits)
          VALUES ($1, $2, 'events', $3, 'active', $4, $5, $6, $7, $8)
          ON CONFLICT (organization_id, product) DO UPDATE SET
            plan = EXCLUDED.plan,
            status = 'active',
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            limits = EXCLUDED.limits
        `, [
          crypto.randomUUID(), orgId, plan, subscriptionId, customerId,
          period.start, period.end,
          JSON.stringify(limits),
        ])

        console.log(`[stripe/webhook] Activated ${plan} subscription for org ${orgId}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice.parent?.subscription_details?.subscription || '') as string

        if (!subscriptionId) break

        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const orgId = sub.metadata?.organizationId

        if (!orgId) break

        const period = getSubscriptionPeriod(sub)

        await db.query(`
          UPDATE product_subscriptions
          SET status = 'active',
              current_period_start = $1,
              current_period_end = $2
          WHERE organization_id = $3 AND product = 'events'
        `, [period.start, period.end, orgId])

        console.log(`[stripe/webhook] Invoice paid, renewed subscription for org ${orgId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice.parent?.subscription_details?.subscription || '') as string

        if (!subscriptionId) break

        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const orgId = sub.metadata?.organizationId

        if (!orgId) break

        await db.query(
          "UPDATE product_subscriptions SET status = 'past_due' WHERE organization_id = $1 AND product = 'events'",
          [orgId]
        )

        console.log(`[stripe/webhook] Payment failed for org ${orgId}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.organizationId
        const plan = (sub.metadata?.plan || 'grassroots') as EventsPlan

        if (!orgId) break

        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.grassroots
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'trialing' ? 'trialing'
          : sub.status === 'past_due' ? 'past_due'
          : 'cancelled'

        const period = getSubscriptionPeriod(sub)

        await db.query(`
          UPDATE product_subscriptions
          SET plan = $1, status = $2, limits = $3,
              current_period_start = $4, current_period_end = $5
          WHERE organization_id = $6 AND product = 'events'
        `, [
          plan, status, JSON.stringify(limits),
          period.start, period.end,
          orgId,
        ])

        console.log(`[stripe/webhook] Subscription updated for org ${orgId}: ${plan} (${status})`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.organizationId

        if (!orgId) break

        await db.query(
          "UPDATE product_subscriptions SET status = 'cancelled' WHERE organization_id = $1 AND product = 'events'",
          [orgId]
        )

        console.log(`[stripe/webhook] Subscription cancelled for org ${orgId}`)
        break
      }
    }
  } catch (error) {
    console.error('[stripe/webhook] Error processing event:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
