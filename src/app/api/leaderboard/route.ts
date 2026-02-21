import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET() {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    const { rows: leaderboard } = await db.query(`
      SELECT
        u.id, u.name,
        COUNT(DISTINCT c.id) as contacts,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) as contacted,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) as supporters,
        CASE WHEN COUNT(DISTINCT c.id) > 0
          THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) AS DECIMAL) / COUNT(DISTINCT c.id) * 100, 1)
          ELSE 0 END as contact_rate,
        CASE WHEN COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) > 0
          THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) AS DECIMAL) / COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) * 100, 1)
          ELSE 0 END as conversion_rate
      FROM users u
      LEFT JOIN contacts c ON c.user_id = u.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE u.role = 'volunteer'
      GROUP BY u.id, u.name
      HAVING COUNT(DISTINCT c.id) > 0
      ORDER BY supporters DESC, contacted DESC
      LIMIT 50
    `)

    return NextResponse.json({ leaderboard, currentUserId: session.userId })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
