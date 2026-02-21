import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET() {
  try {
    requireAdmin()
    const db = await getDb()

    const { rows: volunteers } = await db.query(`
      SELECT
        u.id, u.email, u.name, u.created_at,
        COUNT(DISTINCT c.id) as contact_count,
        COUNT(DISTINCT CASE WHEN mr.status = 'confirmed' THEN mr.id END) as matched_count,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) as contacted_count,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) as supporter_count,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'undecided' THEN ai.id END) as undecided_count,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'opposed' THEN ai.id END) as opposed_count
      FROM users u
      LEFT JOIN contacts c ON c.user_id = u.id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      GROUP BY u.id, u.email, u.name, u.created_at
      ORDER BY u.created_at DESC
    `)

    return NextResponse.json({ volunteers })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
