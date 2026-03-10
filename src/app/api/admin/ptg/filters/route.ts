import { NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/filters
 * Returns distinct filter options for the conversations spreadsheet.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    // Regions
    const { rows: regionRows } = await db.query(`
      SELECT DISTINCT COALESCE(t.region, m.region) as region
      FROM contacts c
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN memberships m ON m.user_id = c.user_id AND m.campaign_id = c.campaign_id
      WHERE c.campaign_id = $1 AND COALESCE(t.region, m.region) IS NOT NULL
      ORDER BY region
    `, [ctx.campaignId])

    // Organizers (users with organizer role or who have invited others)
    const { rows: organizerRows } = await db.query(`
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1
      WHERE m.role IN ('organizer', 'admin', 'owner')
         OR EXISTS (SELECT 1 FROM memberships m2 WHERE m2.invited_by = u.id AND m2.campaign_id = $1)
         OR EXISTS (SELECT 1 FROM turfs t WHERE t.organizer_id = u.id AND t.campaign_id = $1)
      ORDER BY u.name
    `, [ctx.campaignId])

    // Volunteers (all users with contacts)
    const { rows: volunteerRows } = await db.query(`
      SELECT DISTINCT u.id, u.name
      FROM users u
      JOIN contacts c ON c.user_id = u.id AND c.campaign_id = $1
      ORDER BY u.name
    `, [ctx.campaignId])

    // Distinct outcomes
    const { rows: outcomeRows } = await db.query(`
      SELECT DISTINCT ai.contact_outcome
      FROM action_items ai
      JOIN contacts c ON c.id = ai.contact_id AND c.campaign_id = $1
      WHERE ai.contact_outcome IS NOT NULL AND ai.contact_outcome != ''
      ORDER BY ai.contact_outcome
    `, [ctx.campaignId])

    return NextResponse.json({
      regions: regionRows.map((r: Record<string, unknown>) => r.region as string),
      organizers: organizerRows.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name })),
      volunteers: volunteerRows.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name })),
      outcomes: outcomeRows.map((r: Record<string, unknown>) => r.contact_outcome as string),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
