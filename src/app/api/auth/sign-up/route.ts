import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { hashPassword, createSessionToken } from '@/lib/auth'
import campaignConfig from '@/lib/campaign-config'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP
    const ip = getClientIP(request)
    const rateLimit = checkRateLimit(`sign-up:${ip}`)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many sign-up attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      )
    }

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

    const db = await getDb()

    // Check if email already exists
    const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existingRows[0]) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Create user
    const id = crypto.randomUUID()
    const passwordHash = hashPassword(password)

    await db.query(`
      INSERT INTO users (id, email, password_hash, name, role, campaign_id)
      VALUES ($1, $2, $3, $4, 'volunteer', $5)
    `, [id, email.toLowerCase(), passwordHash, name.trim(), campaignConfig.id])

    // Log activity
    await logActivity(id, 'sign_up', { email: email.toLowerCase() })

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
