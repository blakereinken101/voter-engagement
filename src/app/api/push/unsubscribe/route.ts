import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
    }

    const db = await getDb()

    // Safely match by parsing stored JSON rather than using LIKE (prevents injection)
    const { rows: existing } = await db.query(
      `SELECT id, subscription FROM push_subscriptions WHERE user_id = $1`,
      [session.userId]
    )
    for (const row of existing) {
      try {
        const sub = JSON.parse(row.subscription as string)
        if (sub.endpoint === endpoint) {
          await db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id])
        }
      } catch { /* skip malformed rows */ }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[push/unsubscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
