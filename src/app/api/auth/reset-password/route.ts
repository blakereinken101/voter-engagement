import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { userId, newPassword } = body

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'userId and newPassword are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const db = await getDb()

    // Verify user exists
    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [userId])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    // Hash and update password
    const passwordHash = hashPassword(newPassword)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
