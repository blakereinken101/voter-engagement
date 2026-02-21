import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(_request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    requireAdmin()
    const db = await getDb()
    const { userId } = params

    const { rows: userRows } = await db.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [userId])
    if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { rows: contacts } = await db.query(`
      SELECT c.*,
             mr.status as match_status, mr.best_match_data, mr.vote_score, mr.segment, mr.user_confirmed,
             ai.contacted, ai.contacted_date, ai.outreach_method, ai.contact_outcome, ai.notes,
             ai.is_volunteer_prospect
      FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [userId])

    return NextResponse.json({ user: userRows[0], contacts })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
