import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPendingSession, generateVerificationCode } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/email'

export async function POST() {
  try {
    const pending = getPendingSession()
    if (!pending) {
      return NextResponse.json({ error: 'No pending verification. Please sign in again.' }, { status: 401 })
    }

    const db = await getDb()

    // Rate limit: check if a code was sent in the last 60 seconds
    const { rows: recentCodes } = await db.query(
      `SELECT created_at FROM verification_codes
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'
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

    // Invalidate existing codes
    await db.query(
      'UPDATE verification_codes SET used = true WHERE user_id = $1 AND used = false',
      [pending.userId]
    )

    // Generate and store new code
    const code = generateVerificationCode()
    const codeId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.query(
      `INSERT INTO verification_codes (id, user_id, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [codeId, pending.userId, code, expiresAt.toISOString()]
    )

    // Send via email
    await sendVerificationCode(pending.email, code)

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('[auth/resend-code] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
