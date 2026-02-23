import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, createPendingToken, generateVerificationCode } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/email'
import { sanitizeSlug, validateSlug } from '@/lib/slugs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, organizationName, slug: rawSlug, product } = body

    // ── Validate inputs ──────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const normalizedEmail = email.toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!organizationName || typeof organizationName !== 'string' || organizationName.trim().length === 0) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    const slug = sanitizeSlug(rawSlug || organizationName)
    const slugCheck = validateSlug(slug)
    if (!slugCheck.valid) {
      return NextResponse.json({ error: slugCheck.error }, { status: 400 })
    }

    const db = await getDb()

    // ── Check uniqueness ─────────────────────────────────────────────
    const { rows: existingUser } = await db.query(
      'SELECT id FROM users WHERE email = $1', [normalizedEmail]
    )
    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const { rows: existingSlug } = await db.query(
      'SELECT id FROM organizations WHERE slug = $1', [slug]
    )
    if (existingSlug.length > 0) {
      return NextResponse.json({ error: 'This URL is already taken. Please choose a different one.' }, { status: 409 })
    }

    // ── Create everything in a transaction ───────────────────────────
    const client = await db.connect()
    let userId: string
    let campaignId: string

    try {
      await client.query('BEGIN')

      userId = crypto.randomUUID()
      const orgId = crypto.randomUUID()
      campaignId = crypto.randomUUID()
      const membershipId = crypto.randomUUID()

      const passwordHash = hashPassword(password)

      // Create user
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, campaign_id, is_platform_admin)
         VALUES ($1, $2, $3, $4, 'volunteer', $5, false)`,
        [userId, normalizedEmail, passwordHash, name.trim(), campaignId]
      )

      // Create organization
      await client.query(
        `INSERT INTO organizations (id, name, slug, created_by)
         VALUES ($1, $2, $3, $4)`,
        [orgId, organizationName.trim(), slug, userId]
      )

      // Create campaign (needed for the membership chain)
      await client.query(
        `INSERT INTO campaigns (id, org_id, name, slug, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [campaignId, orgId, organizationName.trim(), slug]
      )

      // Create membership with admin role
      await client.query(
        `INSERT INTO memberships (id, user_id, campaign_id, role)
         VALUES ($1, $2, $3, 'campaign_admin')`,
        [membershipId, userId, campaignId]
      )

      // No subscription created — users start on the free tier (2 events free)
      // They can upgrade via /events/pricing when they need more

      await client.query('COMMIT')
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }

    // ── 2FA verification (same pattern as sign-in) ───────────────────
    const code = generateVerificationCode()
    const codeId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.query(
      `INSERT INTO verification_codes (id, user_id, code, expires_at, type)
       VALUES ($1, $2, $3, $4, 'two_factor')`,
      [codeId, userId, code, expiresAt.toISOString()]
    )

    await sendVerificationCode(normalizedEmail, code)

    const pendingToken = createPendingToken(userId, normalizedEmail)

    const response = NextResponse.json({
      requiresVerification: true,
      email: normalizedEmail,
      slug,
    })

    response.cookies.set('vc-2fa-pending', pendingToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    })

    return response
  } catch (error) {
    console.error('[auth/sign-up] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
