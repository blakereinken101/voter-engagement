import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, getActiveCampaignId } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'
import { FREE_EVENT_LIMIT } from '@/types/events'

export async function GET() {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    const { rows } = await db.query(
      'SELECT id, email, name, is_platform_admin, created_at FROM users WHERE id = $1',
      [session.userId]
    )

    const user = rows[0] as { id: string; email: string; name: string; is_platform_admin: boolean; created_at: string } | undefined

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Get user's product access (the single source of truth)
    const { rows: productRows } = await db.query(
      `SELECT product FROM user_products WHERE user_id = $1 AND is_active = true`,
      [user.id]
    )
    const userProducts = productRows.map((r: { product: string }) => r.product)

    // Get all active memberships with campaign info (may be empty for events-only users)
    const { rows: memberRows } = await db.query(`
      SELECT m.id, m.campaign_id as "campaignId", m.role, m.joined_at as "joinedAt", m.is_active as "isActive",
             c.name as "campaignName", c.slug as "campaignSlug",
             o.name as "orgName"
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1 AND m.is_active = true
      ORDER BY m.joined_at DESC
    `, [user.id])

    const memberships = memberRows.map(m => ({
      ...m,
      userId: user.id,
    }))

    // Determine active membership from cookie (only relevant for relational users)
    const activeCampaignId = getActiveCampaignId()
    const activeMembership = activeCampaignId
      ? memberships.find((m: { campaignId: string }) => m.campaignId === activeCampaignId) || memberships[0] || null
      : memberships[0] || null

    // Load campaign config from DB for the active campaign (skip for events-only users)
    const campaignConfig = activeMembership
      ? await getCampaignConfig(activeMembership.campaignId)
      : null

    // Load product subscriptions for user's organizations
    const { rows: subRows } = await db.query(`
      SELECT ps.product, ps.plan, ps.status, o.id as org_id
      FROM product_subscriptions ps
      JOIN organizations o ON o.id = ps.organization_id
      WHERE o.created_by = $1
        AND ps.status IN ('active', 'trialing')
      UNION
      SELECT ps.product, ps.plan, ps.status, o.id as org_id
      FROM product_subscriptions ps
      JOIN organizations o ON o.id = ps.organization_id
      JOIN campaigns c ON c.org_id = o.id
      JOIN memberships m ON m.campaign_id = c.id
      WHERE m.user_id = $1 AND m.is_active = true
        AND ps.status IN ('active', 'trialing')
    `, [user.id])

    const productSubscriptions = subRows.map(s => ({
      product: s.product,
      plan: s.plan,
      status: s.status,
      organizationId: s.org_id,
    }))

    // Get user's organization slug and ID for vanity URL + event count
    // Check both created_by and membership chain
    const { rows: orgSlugRows } = await db.query(`
      SELECT slug, id as org_id FROM organizations WHERE created_by = $1
      UNION
      SELECT DISTINCT o.slug, o.id as org_id
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1 AND m.is_active = true
      LIMIT 1
    `, [user.id])

    // Count org's events for free tier tracking
    let freeEventsUsed = 0
    let freeEventsRemaining = FREE_EVENT_LIMIT
    if (orgSlugRows[0]?.org_id) {
      const { rows: eventCountRows } = await db.query(
        `SELECT COUNT(*) FROM events WHERE organization_id = $1 AND status IN ('published', 'draft')`,
        [orgSlugRows[0].org_id]
      )
      freeEventsUsed = parseInt(eventCountRows[0].count, 10)
      freeEventsRemaining = Math.max(0, FREE_EVENT_LIMIT - freeEventsUsed)
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPlatformAdmin: user.is_platform_admin,
        createdAt: user.created_at,
      },
      memberships,
      activeMembership,
      campaignConfig,
      productSubscriptions,
      userProducts,
      organizationSlug: orgSlugRows[0]?.slug || null,
      freeEventsUsed,
      freeEventsRemaining,
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
