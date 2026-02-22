import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { generateVerificationCode, createResetPendingToken } from '@/lib/auth'
import { sendPasswordResetCode } from '@/lib/email'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limiting
    const ip = getClientIP(request)
    const rateCheck = checkRateLimit(`forgot-password:${ip}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    })

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const db = await getDb()

    // Look up user — but ALWAYS return success to prevent enumeration
    const { rows } = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [normalizedEmail]
    )

    const user = rows[0] as { id: string; email: string } | undefined

    if (user) {
      // Per-user rate limit: no more than one code per 60 seconds
      const { rows: recentCodes } = await db.query(
        `SELECT created_at FROM verification_codes
         WHERE user_id = $1 AND type = 'password_reset' AND created_at > NOW() - INTERVAL '60 seconds'
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      )

      if (recentCodes.length === 0) {
        // Invalidate existing unused password reset codes
        await db.query(
          `UPDATE verification_codes SET used = true WHERE user_id = $1 AND used = false AND type = 'password_reset'`,
          [user.id]
        )

        const code = generateVerificationCode()
        const codeId = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

        await db.query(
          `INSERT INTO verification_codes (id, user_id, code, expires_at, type)
           VALUES ($1, $2, $3, $4, 'password_reset')`,
          [codeId, user.id, code, expiresAt.toISOString()]
        )

        await sendPasswordResetCode(user.email, code)
      }

      // Set reset pending cookie
      const resetToken = createResetPendingToken(user.id, user.email)
      const response = NextResponse.json({ sent: true })
      response.cookies.set('vc-reset-pending', resetToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
      })
      return response
    }

    // User not found — return identical success response
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('[auth/forgot-password] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
