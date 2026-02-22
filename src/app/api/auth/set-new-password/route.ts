import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

interface ResetVerifiedPayload {
  userId: string
  email: string
  resetVerified: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Read and verify the reset-verified cookie
    const token = request.cookies.get('vc-reset-verified')?.value
    if (!token) {
      return NextResponse.json(
        { error: 'Reset session expired. Please start over.' },
        { status: 401 }
      )
    }

    let payload: ResetVerifiedPayload
    try {
      payload = jwt.verify(token, JWT_SECRET) as ResetVerifiedPayload
      if (!payload.resetVerified) throw new Error('Invalid token')
    } catch {
      return NextResponse.json(
        { error: 'Reset session expired. Please start over.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { newPassword } = body

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const db = await getDb()

    // Verify user still exists
    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [payload.userId])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    // Hash and update
    const passwordHash = hashPassword(newPassword)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, payload.userId])

    // Clear the reset-verified cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('vc-reset-verified', '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error('[auth/set-new-password] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
