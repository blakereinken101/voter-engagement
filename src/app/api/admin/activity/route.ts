import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')

    let query = `
      SELECT al.*, u.name as user_name
      FROM activity_log al
      JOIN users u ON u.id = al.user_id
      WHERE al.campaign_id = $1
    `
    const params: unknown[] = [ctx.campaignId]
    let paramIdx = 2

    if (userId) {
      query += ` AND al.user_id = $${paramIdx++}`
      params.push(userId)
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIdx}`
    params.push(limit)

    const { rows: activities } = await db.query(query, params)

    return NextResponse.json({ activities })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
