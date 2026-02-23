import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyPassword, createPendingToken, generateVerificationCode } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, product } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const db = await getDb()

    const { rows } = await db.query(
      'SELECT id, email, password_hash, name, is_platform_admin FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    const user = rows[0] as { id: string; email: string; password_hash: string; name: string; is_platform_admin: boolean } | undefined

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Generate 2FA code
    const code = generateVerificationCode()
    const codeId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Invalidate any existing unused 2FA codes for this user
    await db.query(
      `UPDATE verification_codes SET used = true WHERE user_id = $1 AND used = false AND type = 'two_factor'`,
      [user.id]
    )

    // Store new code
    await db.query(
      `INSERT INTO verification_codes (id, user_id, code, expires_at, type)
       VALUES ($1, $2, $3, $4, 'two_factor')`,
      [codeId, user.id, code, expiresAt.toISOString()]
    )

    // Send code via email
    await sendVerificationCode(user.email, code)

    // Create pending 2FA token (short-lived, can't access dashboard)
    const pendingToken = createPendingToken(user.id, user.email, { product })

    const response = NextResponse.json({
      requiresVerification: true,
      email: user.email,
    })

    response.cookies.set('vc-2fa-pending', pendingToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1800, // 30 minutes
    })

    return response
  } catch (error) {
    console.error('[auth/sign-in] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
