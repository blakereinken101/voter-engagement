import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, getActiveCampaignId } from '@/lib/auth'
import { getCampaignConfig } from '@/lib/campaign-config.server'

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

    // Get all active memberships with campaign info
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

    // Determine active membership from cookie
    const activeCampaignId = getActiveCampaignId()
    const activeMembership = activeCampaignId
      ? memberships.find((m: { campaignId: string }) => m.campaignId === activeCampaignId) || memberships[0] || null
      : memberships[0] || null

    // Load campaign config from DB for the active campaign
    const campaignConfig = activeMembership
      ? await getCampaignConfig(activeMembership.campaignId)
      : null

    // Load product subscriptions for user's organizations
    const orgIds = [...new Set(memberRows.map(m => m.orgName ? memberRows.find(mr => mr.orgName === m.orgName) : null).filter(Boolean))]
    const { rows: subRows } = await db.query(`
      SELECT ps.product, ps.plan, ps.status, o.id as org_id
      FROM product_subscriptions ps
      JOIN organizations o ON o.id = ps.organization_id
      JOIN campaigns c ON c.org_id = o.id
      JOIN memberships m ON m.campaign_id = c.id
      WHERE m.user_id = $1 AND m.is_active = true
        AND ps.status IN ('active', 'trialing')
      GROUP BY ps.id, o.id
    `, [user.id])

    const productSubscriptions = subRows.map(s => ({
      product: s.product,
      plan: s.plan,
      status: s.status,
      organizationId: s.org_id,
    }))

    // Get user's organization slug for vanity URL
    const { rows: orgSlugRows } = await db.query(`
      SELECT DISTINCT o.slug
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1 AND m.is_active = true
      LIMIT 1
    `, [user.id])

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
      organizationSlug: orgSlugRows[0]?.slug || null,
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
