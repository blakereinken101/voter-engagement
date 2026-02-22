import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyPassword, createSessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

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

    // Get memberships with campaign info
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

    const memberships = memberRows.map(m => ({
      ...m,
      userId: user.id,
    }))

    const token = createSessionToken({ userId: user.id, email: user.email })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPlatformAdmin: user.is_platform_admin,
      },
      memberships,
      activeMembership: memberships[0] || null,
    })

    response.headers.append('Set-Cookie', `vc-session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`)
    if (memberships[0]) {
      response.headers.append('Set-Cookie', `vc-campaign=${memberships[0].campaignId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`)
    }

    return response
  } catch (error) {
    console.error('[auth/sign-in] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
