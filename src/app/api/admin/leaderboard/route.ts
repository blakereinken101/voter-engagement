import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET() {
  try {
    requireAdmin()
    const db = getDb()

    const leaderboard = db.prepare(`
      SELECT
        u.id, u.name,
        COUNT(DISTINCT c.id) as contacts,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) as contacted,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) as supporters,
        CASE WHEN COUNT(DISTINCT c.id) > 0
          THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) AS FLOAT) / COUNT(DISTINCT c.id) * 100, 1)
          ELSE 0 END as contact_rate,
        CASE WHEN COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) > 0
          THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) AS FLOAT) / COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) * 100, 1)
          ELSE 0 END as conversion_rate
      FROM users u
      LEFT JOIN contacts c ON c.user_id = u.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE u.role = 'volunteer'
      GROUP BY u.id
      HAVING COUNT(DISTINCT c.id) > 0
      ORDER BY supporters DESC, contacted DESC
    `).all()

    return NextResponse.json({ leaderboard })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
