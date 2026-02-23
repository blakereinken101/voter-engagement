import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, AuthError, handleAuthError } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    // Find user's org
    const { rows: orgRows } = await db.query(`
      SELECT DISTINCT o.id
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

    // Get Stripe customer ID
    const { rows: subRows } = await db.query(
      "SELECT stripe_customer_id FROM product_subscriptions WHERE organization_id = $1 AND product = 'events'",
      [orgId]
    )

    const customerId = subRows[0]?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe subscription found. Subscribe first at /events/pricing' }, { status: 404 })
    }

    const origin = request.headers.get('origin') || request.nextUrl.origin

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/events/manage`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[stripe/portal] Error:', error)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
