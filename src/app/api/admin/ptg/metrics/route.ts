import { NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

const DEFAULT_VOLUNTEER_THRESHOLD = 5

/**
 * GET /api/admin/ptg/metrics
 *
 * KPIs:
 *  - Relational Volunteers: users (volunteer/organizer role) with >= threshold
 *    documented conversations or contacts. Weekly / Daily / Total.
 *  - Active Relational Volunteers: same criteria but only counting THIS WEEK
 *    (Monday–Sunday). Weekly only.
 *  - Relational Conversations: conversations logged by volunteer-tier users.
 *    Weekly / Daily / Total.
 *  - Contacts Roladexed: contacts created by volunteer-tier users.
 *    Weekly / Daily / Total.
 *
 * All broken down by region and organizer.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    // Load configurable threshold from campaign settings
    const { rows: campRows } = await db.query(
      'SELECT settings FROM campaigns WHERE id = $1',
      [ctx.campaignId],
    )
    const settings = (campRows[0]?.settings || {}) as Record<string, unknown>
    const threshold = Number(settings.relationalVolunteerThreshold) || DEFAULT_VOLUNTEER_THRESHOLD

    // Week start = most recent Monday at 00:00
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
    const weekStartISO = weekStart.toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    // Volunteer-tier roles (not platform_admin)
    const volRoles = ['volunteer', 'organizer']

    // ── Relational Volunteers ──
    // Users with >= threshold total contacts in this campaign
    const { rows: relVolRows } = await db.query(`
      SELECT
        u.id,
        u.name,
        COALESCE(t.region, org_m.region) as region,
        org_u.name as organizer_name,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN c.created_at >= $3 THEN 1 END) as weekly_contacts,
        COUNT(CASE WHEN c.created_at >= $4 THEN 1 END) as daily_contacts
      FROM users u
      JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1 AND m.role = ANY($2)
      JOIN contacts c ON c.user_id = u.id AND c.campaign_id = $1
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN memberships org_m ON org_m.user_id = m.organizer_id AND org_m.campaign_id = $1
      LEFT JOIN users org_u ON org_u.id = m.organizer_id
      GROUP BY u.id, u.name, region, org_u.name
    `, [ctx.campaignId, volRoles, weekStartISO, todayStart])

    // Relational volunteer = total_contacts >= threshold
    const relationalVols = relVolRows.filter((r: Record<string, unknown>) => Number(r.total_contacts) >= threshold)
    // Active = weekly_contacts >= threshold
    const activeVols = relVolRows.filter((r: Record<string, unknown>) => Number(r.weekly_contacts) >= threshold)

    // ── Relational Conversations ──
    // Conversations (action_items with an outcome) from volunteer-tier users
    const { rows: convoRows } = await db.query(`
      SELECT
        COALESCE(t.region, org_m.region, 'Unassigned') as region,
        COALESCE(org_u.name, 'Unassigned') as organizer_name,
        COUNT(*) as overall,
        COUNT(CASE WHEN c.created_at >= $3 THEN 1 END) as weekly,
        COUNT(CASE WHEN c.created_at >= $4 THEN 1 END) as daily
      FROM contacts c
      JOIN action_items ai ON ai.contact_id = c.id
        AND ai.contact_outcome IS NOT NULL AND ai.contact_outcome != ''
      JOIN memberships m ON m.user_id = c.user_id AND m.campaign_id = $1 AND m.role = ANY($2)
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN memberships org_m ON org_m.user_id = m.organizer_id AND org_m.campaign_id = $1
      LEFT JOIN users org_u ON org_u.id = m.organizer_id
      WHERE c.campaign_id = $1
      GROUP BY region, organizer_name
    `, [ctx.campaignId, volRoles, weekStartISO, todayStart])

    // ── Contacts Roladexed ──
    // All contacts created by volunteer-tier users
    const { rows: rolodexRows } = await db.query(`
      SELECT
        COALESCE(t.region, org_m.region, 'Unassigned') as region,
        COALESCE(org_u.name, 'Unassigned') as organizer_name,
        COUNT(*) as overall,
        COUNT(CASE WHEN c.created_at >= $3 THEN 1 END) as weekly,
        COUNT(CASE WHEN c.created_at >= $4 THEN 1 END) as daily
      FROM contacts c
      JOIN memberships m ON m.user_id = c.user_id AND m.campaign_id = $1 AND m.role = ANY($2)
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN memberships org_m ON org_m.user_id = m.organizer_id AND org_m.campaign_id = $1
      LEFT JOIN users org_u ON org_u.id = m.organizer_id
      WHERE c.campaign_id = $1
      GROUP BY region, organizer_name
    `, [ctx.campaignId, volRoles, weekStartISO, todayStart])

    // ── Aggregate helpers ──
    type GroupRow = Record<string, unknown>

    function sumField(rows: GroupRow[], field: string) {
      return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0)
    }

    function groupByRegion(rows: GroupRow[]) {
      const map = new Map<string, { daily: number; weekly: number; overall: number }>()
      for (const r of rows) {
        const region = (r.region as string) || 'Unassigned'
        const prev = map.get(region) || { daily: 0, weekly: 0, overall: 0 }
        map.set(region, {
          daily: prev.daily + (Number(r.daily) || 0),
          weekly: prev.weekly + (Number(r.weekly) || 0),
          overall: prev.overall + (Number(r.overall) || 0),
        })
      }
      return Array.from(map.entries())
        .map(([region, v]) => ({ region, ...v }))
        .sort((a, b) => b.overall - a.overall)
    }

    function groupByOrganizer(rows: GroupRow[]) {
      const map = new Map<string, { daily: number; weekly: number; overall: number }>()
      for (const r of rows) {
        const name = (r.organizer_name as string) || 'Unassigned'
        const prev = map.get(name) || { daily: 0, weekly: 0, overall: 0 }
        map.set(name, {
          daily: prev.daily + (Number(r.daily) || 0),
          weekly: prev.weekly + (Number(r.weekly) || 0),
          overall: prev.overall + (Number(r.overall) || 0),
        })
      }
      return Array.from(map.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.overall - a.overall)
    }

    // Count relational vols by region/organizer
    function countVolsByGroup(vols: GroupRow[], groupKey: 'region' | 'organizer_name') {
      const map = new Map<string, number>()
      for (const v of vols) {
        const key = (v[groupKey] as string) || 'Unassigned'
        map.set(key, (map.get(key) || 0) + 1)
      }
      return map
    }

    const relVolByRegion = countVolsByGroup(relationalVols, 'region')
    const relVolByOrg = countVolsByGroup(relationalVols, 'organizer_name')
    const activeVolByRegion = countVolsByGroup(activeVols, 'region')
    const activeVolByOrg = countVolsByGroup(activeVols, 'organizer_name')

    return NextResponse.json({
      threshold,
      summary: {
        relationalVolunteers: { weekly: relationalVols.length, daily: relationalVols.length, total: relationalVols.length },
        activeRelationalVolunteers: { weekly: activeVols.length },
        relationalConversations: {
          daily: sumField(convoRows, 'daily'),
          weekly: sumField(convoRows, 'weekly'),
          total: sumField(convoRows, 'overall'),
        },
        contactsRoladexed: {
          daily: sumField(rolodexRows, 'daily'),
          weekly: sumField(rolodexRows, 'weekly'),
          total: sumField(rolodexRows, 'overall'),
        },
      },
      byRegion: groupByRegion(rolodexRows).map(r => ({
        region: r.region,
        relationalVolunteers: relVolByRegion.get(r.region) || 0,
        activeRelationalVolunteers: activeVolByRegion.get(r.region) || 0,
        conversations: { daily: 0, weekly: 0, overall: 0, ...groupByRegion(convoRows).find(c => c.region === r.region) },
        contacts: { daily: r.daily, weekly: r.weekly, overall: r.overall },
      })),
      byOrganizer: groupByOrganizer(rolodexRows).map(r => ({
        name: r.name,
        relationalVolunteers: relVolByOrg.get(r.name) || 0,
        activeRelationalVolunteers: activeVolByOrg.get(r.name) || 0,
        conversations: { daily: 0, weekly: 0, overall: 0, ...groupByOrganizer(convoRows).find(c => c.name === r.name) },
        contacts: { daily: r.daily, weekly: r.weekly, overall: r.overall },
      })),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
