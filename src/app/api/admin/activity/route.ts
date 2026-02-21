import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    requireAdmin()
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')

    let query = `
      SELECT al.*, u.name as user_name
      FROM activity_log al
      JOIN users u ON u.id = al.user_id
    `
    const params: unknown[] = []

    if (userId) {
      query += ' WHERE al.user_id = ?'
      params.push(userId)
    }

    query += ' ORDER BY al.created_at DESC LIMIT ?'
    params.push(limit)

    const activities = db.prepare(query).all(...params)

    return NextResponse.json({ activities })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
