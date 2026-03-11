import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/metrics/timeseries
 * Returns daily or weekly aggregates for charting.
 * Params: period (7d|30d|90d|all), granularity (day|week)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const granularity = searchParams.get('granularity') === 'week' ? 'week' : 'day'

    const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, all: 3650 }
    const days = periodDays[period] || 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    const volRoles = ['volunteer', 'organizer']

    const { rows } = await db.query(`
      SELECT
        DATE_TRUNC($3, c.created_at)::date as date,
        COUNT(*) as contacts,
        COUNT(CASE WHEN ai.contact_outcome IS NOT NULL AND ai.contact_outcome != '' THEN 1 END) as conversations,
        COUNT(DISTINCT c.user_id) as active_volunteers
      FROM contacts c
      JOIN memberships m ON m.user_id = c.user_id AND m.campaign_id = $1 AND m.role = ANY($2)
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE c.campaign_id = $1 AND c.created_at >= $4
      GROUP BY DATE_TRUNC($3, c.created_at)::date
      ORDER BY date ASC
    `, [ctx.campaignId, volRoles, granularity, sinceISO])

    const dates = rows.map((r: Record<string, unknown>) => ({
      date: new Date(r.date as string).toISOString().slice(0, 10),
      contacts: Number(r.contacts) || 0,
      conversations: Number(r.conversations) || 0,
      activeVolunteers: Number(r.active_volunteers) || 0,
    }))

    return NextResponse.json({ dates })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
