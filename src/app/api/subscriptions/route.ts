import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, AuthError, handleAuthError } from '@/lib/auth'
import { PLAN_LIMITS } from '@/types/events'
import type { EventsPlan } from '@/types/events'

export async function GET() {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    // Find user's org
    const { rows: orgRows } = await db.query(`
      SELECT DISTINCT o.id, o.name
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1 AND m.is_active = true
    `, [session.userId])

    if (orgRows.length === 0) {
      return NextResponse.json({ subscriptions: [] })
    }

    const orgId = orgRows[0].id
    const { rows } = await db.query(
      'SELECT * FROM product_subscriptions WHERE organization_id = $1',
      [orgId]
    )

    const subscriptions = rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      product: row.product,
      plan: row.plan,
      status: row.status,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      limits: row.limits,
      createdAt: row.created_at,
    }))

    return NextResponse.json({ subscriptions, organizationId: orgId, organizationName: orgRows[0].name })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * Create or update a subscription (manual activation for now).
 * Will be replaced by Stripe webhook handler in follow-up.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    // Check platform admin
    const { rows: userRows } = await db.query(
      'SELECT is_platform_admin FROM users WHERE id = $1',
      [session.userId]
    )
    if (!userRows[0]?.is_platform_admin) {
      return NextResponse.json({ error: 'Only platform admins can manage subscriptions (until Stripe is integrated)' }, { status: 403 })
    }

    const body = await request.json()
    const { organizationId, product, plan } = body

    if (!organizationId || !product || !plan) {
      return NextResponse.json({ error: 'organizationId, product, and plan are required' }, { status: 400 })
    }

    if (product !== 'events') {
      return NextResponse.json({ error: 'Only events subscriptions can be created' }, { status: 400 })
    }

    const validPlans: EventsPlan[] = ['grassroots', 'growth', 'scale']
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` }, { status: 400 })
    }

    const limits = PLAN_LIMITS[plan as EventsPlan]
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const id = crypto.randomUUID()
    await db.query(`
      INSERT INTO product_subscriptions (id, organization_id, product, plan, status, current_period_start, current_period_end, limits)
      VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
      ON CONFLICT (organization_id, product) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = 'active',
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        limits = EXCLUDED.limits
    `, [id, organizationId, product, plan, now.toISOString(), periodEnd.toISOString(), JSON.stringify(limits)])

    return NextResponse.json({ success: true, id, plan, limits })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
