import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/conversations/[contactId]/candidates
 * Returns match candidates for a contact to support manual match resolution.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { contactId: string } },
) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { contactId } = params

    // Fetch the contact + its match_results
    const { rows } = await db.query(`
      SELECT
        c.first_name, c.last_name,
        mr.status, mr.candidates_data, mr.best_match_data
      FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      WHERE c.id = $1 AND c.campaign_id = $2
    `, [contactId, ctx.campaignId])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const row = rows[0]
    const contactName = `${row.first_name || ''} ${row.last_name || ''}`.trim()

    // Parse candidates from stored JSON
    let candidates = []
    if (row.candidates_data) {
      try {
        const parsed = typeof row.candidates_data === 'string'
          ? JSON.parse(row.candidates_data)
          : row.candidates_data
        candidates = Array.isArray(parsed) ? parsed : []
      } catch { /* ignore parse error */ }
    }

    return NextResponse.json({
      contactName,
      currentStatus: row.status || 'pending',
      candidates,
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
