import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/export-toplines
 * Export topline metrics by day as CSV.
 * Organizers can paste these daily numbers into their own PTG spreadsheet.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const region = searchParams.get('region') || ''
    const organizerId = searchParams.get('organizerId') || ''

    // Calculate date range
    const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, all: 3650 }
    const days = periodDays[period] || 30
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    const volRoles = ['volunteer', 'organizer']

    // Build optional filters
    const conditions: string[] = [
      'c.campaign_id = $1',
      'c.created_at >= $3',
    ]
    const params: unknown[] = [ctx.campaignId, volRoles, sinceISO]
    let idx = 4

    if (region) { conditions.push(`COALESCE(t.region, org_m.region) = $${idx}`); params.push(region); idx++ }
    if (organizerId) { conditions.push(`vol_m.organizer_id = $${idx}`); params.push(organizerId); idx++ }

    const where = conditions.join(' AND ')

    // Daily contacts & conversations
    const { rows: dailyRows } = await db.query(`
      SELECT
        DATE_TRUNC('day', c.created_at)::date as date,
        COUNT(*) as contacts_rolodexed,
        COUNT(CASE WHEN ai.contact_outcome IS NOT NULL AND ai.contact_outcome != '' THEN 1 END) as conversations,
        COUNT(DISTINCT c.user_id) as active_volunteers
      FROM contacts c
      JOIN memberships vol_m ON vol_m.user_id = c.user_id AND vol_m.campaign_id = $1 AND vol_m.role = ANY($2)
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN memberships org_m ON org_m.user_id = vol_m.organizer_id AND org_m.campaign_id = $1
      WHERE ${where}
      GROUP BY DATE_TRUNC('day', c.created_at)::date
      ORDER BY date ASC
    `, params)

    // Build CSV
    const headers = ['Date', 'Conversations', 'Contacts Rolodexed', 'Active Volunteers']
    const csvLines = [headers.join(',')]

    for (const r of dailyRows) {
      const dateStr = new Date(r.date as string).toISOString().slice(0, 10)
      csvLines.push([
        dateStr,
        String(r.conversations || 0),
        String(r.contacts_rolodexed || 0),
        String(r.active_volunteers || 0),
      ].join(','))
    }

    const csv = csvLines.join('\n')
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=ptg-toplines-${date}.csv`,
      },
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
