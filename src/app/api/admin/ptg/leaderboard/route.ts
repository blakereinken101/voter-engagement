import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/leaderboard
 * Weekly (Mon–Sun) and daily stats for volunteers.
 * Uses campaign timezone for day boundaries.
 * Params: period=weekly|daily
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'weekly'

    // Get campaign timezone
    const { rows: campRows } = await db.query(
      'SELECT timezone FROM campaigns WHERE id = $1',
      [ctx.campaignId],
    )
    const timezone = campRows[0]?.timezone || 'America/Anchorage'

    const volRoles = ['volunteer', 'organizer']

    // Calculate period start in campaign timezone
    let periodStart: string
    if (period === 'daily') {
      periodStart = `(DATE_TRUNC('day', NOW() AT TIME ZONE '${timezone}') AT TIME ZONE '${timezone}')`
    } else {
      periodStart = `(DATE_TRUNC('week', NOW() AT TIME ZONE '${timezone}') AT TIME ZONE '${timezone}')`
    }

    const { rows } = await db.query(`
      SELECT
        u.id as volunteer_id,
        u.name as volunteer_name,
        COALESCE(org_u.name, 'Unassigned') as organizer_name,
        COALESCE(t.region, org_m.region, 'Unassigned') as region,
        COUNT(c.id) as contacts_rolodexed,
        COUNT(CASE WHEN ai.contact_outcome IS NOT NULL AND ai.contact_outcome != '' THEN 1 END) as conversations,
        COUNT(CASE WHEN ai.volunteer_interest = 'yes' THEN 1 END) as vol_interest_yes,
        COUNT(CASE WHEN ai.contact_outcome = 'supporter' THEN 1 END) as supporters
      FROM contacts c
      JOIN users u ON u.id = c.user_id
      JOIN memberships m ON m.user_id = c.user_id AND m.campaign_id = $1 AND m.role = ANY($2)
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN memberships org_m ON org_m.user_id = m.organizer_id AND org_m.campaign_id = $1
      LEFT JOIN users org_u ON org_u.id = m.organizer_id
      LEFT JOIN turfs t ON t.id = c.turf_id
      WHERE c.campaign_id = $1
        AND c.created_at >= ${periodStart}
      GROUP BY u.id, u.name, COALESCE(org_u.name, 'Unassigned'), COALESCE(t.region, org_m.region, 'Unassigned')
      HAVING COUNT(c.id) > 0
    `, [ctx.campaignId, volRoles])

    // Return raw aggregates — frontend handles grouping/sorting
    const volunteers = rows.map((r: Record<string, unknown>) => ({
      id: r.volunteer_id,
      name: r.volunteer_name,
      organizerName: r.organizer_name,
      region: r.region,
      conversations: Number(r.conversations) || 0,
      contactsRolodexed: Number(r.contacts_rolodexed) || 0,
      supporters: Number(r.supporters) || 0,
      volInterest: Number(r.vol_interest_yes) || 0,
    }))

    return NextResponse.json({
      period,
      timezone,
      periodLabel: period === 'daily'
        ? new Date().toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long', month: 'short', day: 'numeric' })
        : `Week of ${getWeekStart(timezone)}`,
      volunteers,
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

function getWeekStart(timezone: string): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const tzDay = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const dayOfWeek = tzDay.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(tzDay)
  monday.setDate(monday.getDate() - mondayOffset)
  return formatter.format(monday)
}
