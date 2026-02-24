import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'

export async function GET() {
  try {
    const ctx = await getRequestContext()
    const db = await getDb()

    const { rows } = await db.query(
      `SELECT id, entity_type, entity_id, van_endpoint, sync_status, error_message, van_id, created_at
       FROM van_sync_log
       WHERE campaign_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [ctx.campaignId],
    )

    return NextResponse.json({ logs: rows })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[campaign/van-sync-log GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
