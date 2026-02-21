import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, hashPassword, verifyPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    const db = await getDb()

    // Fetch current password hash
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [session.userId])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    const user = rows[0] as { password_hash: string }

    // Verify current password
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    // Hash and update new password
    const passwordHash = hashPassword(newPassword)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, session.userId])

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[auth/change-password] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
