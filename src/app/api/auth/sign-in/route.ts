import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
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
      'SELECT id, email, password_hash, name, role, campaign_id FROM users WHERE email = $1',
      [email.toLowerCase()]
    )
    const user = rows[0] as { id: string; email: string; password_hash: string; name: string; role: string; campaign_id: string } | undefined

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Log activity
    await logActivity(user.id, 'sign_in')

    // Create session
    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'volunteer' | 'admin',
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        campaignId: user.campaign_id,
      }
    })

    response.headers.set('Set-Cookie', `vc-session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`)

    return response
  } catch (error) {
    console.error('[auth/sign-in] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
