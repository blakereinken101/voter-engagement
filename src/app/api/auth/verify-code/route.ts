import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPendingSession, createSessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const pending = getPendingSession()
    if (!pending) {
      return NextResponse.json({ error: 'No pending verification. Please sign in again.' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Please enter a valid 6-digit code' }, { status: 400 })
    }

    const db = await getDb()

    // Find the latest unused 2FA code for this user
    const { rows: codeRows } = await db.query(
      `SELECT id, code, expires_at, attempts
       FROM verification_codes
       WHERE user_id = $1 AND used = false AND type = 'two_factor'
       ORDER BY created_at DESC LIMIT 1`,
      [pending.userId]
    )

    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 })
    }

    const storedCode = codeRows[0]

    // Check attempts
    if (storedCode.attempts >= 5) {
      await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [storedCode.id])
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 })
    }

    // Increment attempts
    await db.query(
      'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1',
      [storedCode.id]
    )

    // Check expiration
    if (new Date(storedCode.expires_at) < new Date()) {
      await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [storedCode.id])
      return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 })
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

    // Get user data + memberships (same as original sign-in response)
    const { rows: userRows } = await db.query(
      'SELECT id, email, name, is_platform_admin FROM users WHERE id = $1',
      [pending.userId]
    )
    const user = userRows[0]
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const { rows: memberRows } = await db.query(`
      SELECT m.id, m.campaign_id as "campaignId", m.role, m.joined_at as "joinedAt", m.is_active as "isActive",
             c.name as "campaignName", c.slug as "campaignSlug",
             o.name as "orgName"
      FROM memberships m
      JOIN campaigns c ON c.id = m.campaign_id
      JOIN organizations o ON o.id = c.org_id
      WHERE m.user_id = $1 AND m.is_active = true
      ORDER BY m.joined_at DESC
    `, [user.id])

    const memberships = memberRows.map(m => ({ ...m, userId: user.id }))

    // Issue full session
    const sessionToken = createSessionToken({ userId: user.id, email: user.email })

    // Compute redirect: return-url cookie > product/plan from JWT > default
    const returnUrl = request.cookies.get('vc-return-url')?.value
    let redirect = '/dashboard'
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      // Use the stored return URL (set by middleware when user was redirected to sign-in)
      redirect = returnUrl
    } else if (pending.product === 'events') {
      redirect = pending.plan
        ? `/events/manage?checkout=${pending.plan}`
        : '/events/manage'
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPlatformAdmin: user.is_platform_admin,
      },
      memberships,
      activeMembership: memberships[0] || null,
      redirect,
    })

    // Clear return-url cookie after use
    response.cookies.set('vc-return-url', '', {
      path: '/',
      sameSite: 'lax',
      maxAge: 0,
    })

    // Set session cookie, clear pending cookie
    response.cookies.set('vc-session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    response.cookies.set('vc-2fa-pending', '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    })
    if (memberships[0]) {
      response.cookies.set('vc-campaign', memberships[0].campaignId, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      })
    }

    return response
  } catch (error) {
    console.error('[auth/verify-code] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
