import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const { rows } = await db.query(`
      SELECT
        u.id, u.email, u.name, u.is_platform_admin, u.created_at,
        COUNT(m.id)::int as membership_count
      FROM users u
      LEFT JOIN memberships m ON m.user_id = u.id AND m.is_active = true
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)

    return NextResponse.json({ users: rows })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
