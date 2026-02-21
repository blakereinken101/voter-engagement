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

    await db.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription LIKE $2`,
      [session.userId, `%${endpoint}%`]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[push/unsubscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
