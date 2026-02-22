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
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
