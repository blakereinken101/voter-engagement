import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth'
import campaignConfig from '@/lib/campaign-config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const db = getDb()

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Create user
    const id = crypto.randomUUID()
    const passwordHash = hashPassword(password)

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, campaign_id)
      VALUES (?, ?, ?, ?, 'volunteer', ?)
    `).run(id, email.toLowerCase(), passwordHash, name.trim(), campaignConfig.id)

    // Log activity
    logActivity(db, id, 'sign_up', { email: email.toLowerCase() })

    // Create session
    const token = createSessionToken({ userId: id, email: email.toLowerCase(), role: 'volunteer' })

    const response = NextResponse.json({
      user: { id, email: email.toLowerCase(), name: name.trim(), role: 'volunteer', campaignId: campaignConfig.id }
    })

    // Set cookie
    response.headers.set('Set-Cookie', `vc-session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`)

    return response
  } catch (error) {
    console.error('[auth/sign-up] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
