import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, AuthError, handleAuthError } from '@/lib/auth'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { plan } = body

    if (!plan || !STRIPE_PRICES[plan]) {
      return NextResponse.json({ error: 'Invalid plan. Available plans: grassroots, growth' }, { status: 400 })
    }

    const priceId = STRIPE_PRICES[plan]
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured for this plan' }, { status: 500 })
    }

    const db = await getDb()

    // Find user's org
    const { rows: orgRows } = await db.query(`
      SELECT DISTINCT o.id, o.name
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1 AND m.is_active = true
      LIMIT 1
    `, [session.userId])

    if (orgRows.length === 0) {
      return NextResponse.json({ error: 'Not a member of any organization' }, { status: 403 })
    }

    const orgId = orgRows[0].id
    const orgName = orgRows[0].name

    // Check for existing Stripe customer
    const { rows: subRows } = await db.query(
      "SELECT stripe_customer_id FROM product_subscriptions WHERE organization_id = $1 AND product = 'events'",
      [orgId]
    )

    let customerId = subRows[0]?.stripe_customer_id

    if (!customerId) {
      // Create Stripe customer
      const customer = await getStripe().customers.create({
        email: session.email,
        name: orgName,
        metadata: { organizationId: orgId },
      })
      customerId = customer.id

      // Store customer ID if subscription row exists
      if (subRows.length > 0) {
        await db.query(
          "UPDATE product_subscriptions SET stripe_customer_id = $1 WHERE organization_id = $2 AND product = 'events'",
          [customerId, orgId]
        )
      }
    }

    // Determine base URL
    const origin = request.headers.get('origin') || request.nextUrl.origin

    // Create Checkout Session
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/events/manage?subscription=success`,
      cancel_url: `${origin}/events/pricing`,
      metadata: { organizationId: orgId, plan },
      subscription_data: {
        metadata: { organizationId: orgId, plan },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[stripe/checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
