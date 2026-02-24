import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requirePlatformAdmin()
    const { userId } = await params

    if (session.userId === userId) {
      return NextResponse.json({ error: 'Cannot modify your own admin status' }, { status: 400 })
    }

    const body = await request.json()
    const { is_platform_admin } = body

    if (typeof is_platform_admin !== 'boolean') {
      return NextResponse.json({ error: 'is_platform_admin must be a boolean' }, { status: 400 })
    }

    const db = await getDb()
    const { rows } = await db.query(
      'UPDATE users SET is_platform_admin = $1 WHERE id = $2 RETURNING id, email, name, is_platform_admin',
      [is_platform_admin, userId]
    )

    if (!rows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: rows[0] })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
