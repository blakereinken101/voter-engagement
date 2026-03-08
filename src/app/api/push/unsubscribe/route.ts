import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { endpoint, deviceToken, platform = 'web' } = body

    const pool = getPool()

    if (platform === 'ios' && deviceToken) {
      // iOS: delete by device token
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND platform = 'ios' AND device_token = $2`,
        [session.userId, deviceToken]
      )
    } else if (endpoint) {
      // Web: match by parsing stored subscription JSON
      const { rows: existing } = await pool.query(
        `SELECT id, subscription FROM push_subscriptions WHERE user_id = $1 AND platform = 'web'`,
        [session.userId]
      )
      for (const row of existing) {
        try {
          const sub = JSON.parse(row.subscription as string)
          if (sub.endpoint === endpoint) {
            await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id])
          }
        } catch { /* skip malformed rows */ }
      }
    } else {
      return NextResponse.json({ error: 'endpoint or deviceToken is required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[push/unsubscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
