import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, verifyPassword, createPendingToken, generateVerificationCode } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/email'
import { sanitizeSlug, validateSlug } from '@/lib/slugs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, organizationName, slug: rawSlug, product, plan } = body

    // Self-signup for relational is not supported — relational access is invite-only
    if (product === 'relational') {
      return NextResponse.json(
        { error: 'Relational access requires a campaign invitation. Ask your campaign admin for an invite link.' },
        { status: 400 }
      )
    }

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

    // ── Check if user already exists ───────────────────────────────
    const { rows: existingUser } = await db.query(
      'SELECT id, password_hash FROM users WHERE email = $1', [normalizedEmail]
    )
    if (existingUser.length > 0) {
      const existing = existingUser[0]
      if (!verifyPassword(password, existing.password_hash)) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Try signing in instead.' },
          { status: 409 }
        )
      }

      // Password matches — grant events product if they don't have it yet
      const { rows: existingProduct } = await db.query(
        `SELECT 1 FROM user_products WHERE user_id = $1 AND product = 'events'`,
        [existing.id]
      )
      if (existingProduct.length === 0) {
        await db.query(
          `INSERT INTO user_products (id, user_id, product) VALUES ($1, $2, 'events')`,
          [crypto.randomUUID(), existing.id]
        )
      }

      // Ensure they have an org for events (relational-only users may not have one as creator)
      const { rows: orgCheck } = await db.query(
        `SELECT id FROM organizations WHERE created_by = $1`, [existing.id]
      )
      if (orgCheck.length === 0) {
        // Check slug availability and create org
        const { rows: slugTaken } = await db.query(
          'SELECT id FROM organizations WHERE slug = $1', [slug]
        )
        if (slugTaken.length === 0) {
          const orgId = crypto.randomUUID()
          await db.query(
            `INSERT INTO organizations (id, name, slug, created_by) VALUES ($1, $2, $3, $4)`,
            [orgId, organizationName.trim(), slug, existing.id]
          )
        }
        // If slug is taken, they can still proceed — they'll use their existing org via membership chain
      }

      // Expire old codes and re-send a fresh one
      await db.query(
        `UPDATE verification_codes SET used = true WHERE user_id = $1 AND used = false`,
        [existing.id]
      )

      const code = generateVerificationCode()
      const codeId = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      await db.query(
        `INSERT INTO verification_codes (id, user_id, code, expires_at, type)
         VALUES ($1, $2, $3, $4, 'two_factor')`,
        [codeId, existing.id, code, expiresAt.toISOString()]
      )

      await sendVerificationCode(normalizedEmail, code)

      const pendingToken = createPendingToken(existing.id, normalizedEmail, { product: 'events', plan })

      // Look up the org slug
      const { rows: orgRows } = await db.query(
        `SELECT slug FROM organizations WHERE created_by = $1 LIMIT 1`,
        [existing.id]
      )

      const response = NextResponse.json({
        requiresVerification: true,
        email: normalizedEmail,
        slug: orgRows[0]?.slug || null,
      })

      response.cookies.set('vc-2fa-pending', pendingToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1800,
      })

      return response
    }

    const { rows: existingSlug } = await db.query(
      'SELECT id FROM organizations WHERE slug = $1', [slug]
    )
    if (existingSlug.length > 0) {
      return NextResponse.json({ error: 'This URL is already taken. Please choose a different one.' }, { status: 409 })
    }

    // ── Create user + org + product access (events-only, no campaign/membership) ──
    const client = await db.connect()
    let userId: string

    try {
      await client.query('BEGIN')

      userId = crypto.randomUUID()
      const orgId = crypto.randomUUID()

      const passwordHash = hashPassword(password)

      // Create user (no campaign_id or role — those are relational-only concerns)
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, is_platform_admin)
         VALUES ($1, $2, $3, $4, false)`,
        [userId, normalizedEmail, passwordHash, name.trim()]
      )

      // Create organization (events need an org for events.organization_id)
      await client.query(
        `INSERT INTO organizations (id, name, slug, created_by)
         VALUES ($1, $2, $3, $4)`,
        [orgId, organizationName.trim(), slug, userId]
      )

      // Grant events product access
      await client.query(
        `INSERT INTO user_products (id, user_id, product)
         VALUES ($1, $2, 'events')`,
        [crypto.randomUUID(), userId]
      )

      // NO campaign or membership creation — those are relational-only

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

    const pendingToken = createPendingToken(userId, normalizedEmail, { product: 'events', plan })

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
      maxAge: 1800,
    })

    return response
  } catch (error) {
    console.error('[auth/sign-up] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
