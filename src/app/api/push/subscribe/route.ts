import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { subscription } = body

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'subscription is required' }, { status: 400 })
    }

    const db = await getDb()

    // Create push_subscriptions table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    const subscriptionJson = JSON.stringify(subscription)

    // Remove any existing subscription with the same endpoint for this user
    // Safely match by parsing stored JSON rather than using LIKE (prevents injection)
    const { rows: existing } = await db.query(
      `SELECT id, subscription FROM push_subscriptions WHERE user_id = $1`,
      [session.userId]
    )
    for (const row of existing) {
      try {
        const sub = JSON.parse(row.subscription as string)
        if (sub.endpoint === subscription.endpoint) {
          await db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id])
        }
      } catch { /* skip malformed rows */ }
    }

    // Insert the new subscription
    const id = crypto.randomUUID()
    await db.query(
      `INSERT INTO push_subscriptions (id, user_id, subscription) VALUES ($1, $2, $3)`,
      [id, session.userId, subscriptionJson]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[push/subscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
