import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getResetPendingSession } from '@/lib/auth'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export async function POST(request: NextRequest) {
  try {
    const pending = getResetPendingSession()
    if (!pending) {
      return NextResponse.json(
        { error: 'No pending reset. Please start over.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Please enter a valid 6-digit code' }, { status: 400 })
    }

    const db = await getDb()

    // Find latest unused password_reset code for this user
    const { rows: codeRows } = await db.query(
      `SELECT id, code, expires_at, attempts
       FROM verification_codes
       WHERE user_id = $1 AND used = false AND type = 'password_reset'
       ORDER BY created_at DESC LIMIT 1`,
      [pending.userId]
    )

    if (codeRows.length === 0) {
      return NextResponse.json(
        { error: 'No reset code found. Please request a new one.' },
        { status: 400 }
      )
    }

    const storedCode = codeRows[0]

    // Check attempts (5 max)
    if (storedCode.attempts >= 5) {
      await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [storedCode.id])
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 429 }
      )
    }

    // Increment attempts
    await db.query(
      'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1',
      [storedCode.id]
    )

    // Check expiration
    if (new Date(storedCode.expires_at) < new Date()) {
      await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [storedCode.id])
      return NextResponse.json(
        { error: 'Code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check code match
    if (storedCode.code !== code) {
      const remaining = 5 - (storedCode.attempts + 1)
      return NextResponse.json({
        error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      }, { status: 400 })
    }

    // Mark code as used
    await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [storedCode.id])

    // Issue a "reset verified" token (short-lived, 10 min)
    const resetVerifiedToken = jwt.sign(
      { userId: pending.userId, email: pending.email, resetVerified: true },
      JWT_SECRET,
      { expiresIn: '10m' }
    )

    const response = NextResponse.json({ verified: true })

    // Replace reset-pending with reset-verified cookie
    response.cookies.set('vc-reset-pending', '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    })
    response.cookies.set('vc-reset-verified', resetVerifiedToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    })

    return response
  } catch (error) {
    console.error('[auth/verify-reset-code] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
