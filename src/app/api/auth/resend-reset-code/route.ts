import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getResetPendingSession, generateVerificationCode } from '@/lib/auth'
import { sendPasswordResetCode } from '@/lib/email'

export async function POST() {
  try {
    const pending = getResetPendingSession()
    if (!pending) {
      return NextResponse.json(
        { error: 'No pending reset. Please start over.' },
        { status: 401 }
      )
    }

    const db = await getDb()

    // Rate limit: 60-second cooldown
    const { rows: recentCodes } = await db.query(
      `SELECT created_at FROM verification_codes
       WHERE user_id = $1 AND type = 'password_reset' AND created_at > NOW() - INTERVAL '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [pending.userId]
    )

    if (recentCodes.length > 0) {
      const waitSeconds = Math.ceil(
        60 - (Date.now() - new Date(recentCodes[0].created_at).getTime()) / 1000
      )
      return NextResponse.json({
        error: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        retryAfter: waitSeconds,
      }, { status: 429 })
    }

    // Invalidate existing unused password reset codes
    await db.query(
      `UPDATE verification_codes SET used = true WHERE user_id = $1 AND used = false AND type = 'password_reset'`,
      [pending.userId]
    )

    // Generate and store new code
    const code = generateVerificationCode()
    const codeId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.query(
      `INSERT INTO verification_codes (id, user_id, code, expires_at, type)
       VALUES ($1, $2, $3, $4, 'password_reset')`,
      [codeId, pending.userId, code, expiresAt.toISOString()]
    )

    // Send via email
    await sendPasswordResetCode(pending.email, code)

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('[auth/resend-reset-code] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
