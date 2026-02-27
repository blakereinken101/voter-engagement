import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, generateVerificationCode, createPendingToken } from '@/lib/auth'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const { rows } = await db.query(`
      SELECT
        u.id, u.email, u.name, u.is_platform_admin, u.created_at,
        COUNT(DISTINCT m.id)::int as membership_count,
        COALESCE(
          json_agg(DISTINCT up.product) FILTER (WHERE up.product IS NOT NULL),
          '[]'
        ) as products
      FROM users u
      LEFT JOIN memberships m ON m.user_id = u.id AND m.is_active = true
      LEFT JOIN user_products up ON up.user_id = u.id AND up.is_active = true
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)

    return NextResponse.json({ users: rows })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin()
    const db = await getDb()

    const body = await request.json()
    const { name, email, password, phone, products } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
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

    // Check if email already exists
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1', [normalizedEmail]
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    const client = await db.connect()
    let userId: string

    try {
      await client.query('BEGIN')

      userId = crypto.randomUUID()
      const passwordHash = hashPassword(password)

      await client.query(
        `INSERT INTO users (id, email, password_hash, name, phone, sms_opt_in, is_platform_admin)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [userId, normalizedEmail, passwordHash, name.trim(), phone?.trim() || null, !!phone?.trim()]
      )

      // Grant requested products
      const validProducts = ['events', 'relational', 'texting']
      const productList: string[] = Array.isArray(products) ? products.filter((p: string) => validProducts.includes(p)) : []

      for (const product of productList) {
        await client.query(
          `INSERT INTO user_products (id, user_id, product, granted_by)
           VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), userId, product, session.userId]
        )
      }

      await client.query('COMMIT')
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }

    return NextResponse.json({
      user: { id: userId, email: normalizedEmail, name: name.trim(), products: products || [] },
    }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
