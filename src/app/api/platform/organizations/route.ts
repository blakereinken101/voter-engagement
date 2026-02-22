import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, AuthError, handleAuthError } from '@/lib/auth'

async function requirePlatformAdmin() {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const db = await getDb()
  const { rows } = await db.query('SELECT is_platform_admin FROM users WHERE id = $1', [session.userId])
  if (!rows[0] || !rows[0].is_platform_admin) {
    throw new AuthError('Platform admin access required', 403)
  }
  return session
}

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const { rows } = await db.query(`
      SELECT o.*, COUNT(c.id) as campaign_count
      FROM organizations o
      LEFT JOIN campaigns c ON c.org_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `)

    return NextResponse.json({ organizations: rows })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin()
    const body = await request.json()
    const { name, slug } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    }

    const db = await getDb()
    const id = crypto.randomUUID()
    const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50)

    await db.query(
      'INSERT INTO organizations (id, name, slug, created_by) VALUES ($1, $2, $3, $4)',
      [id, name.trim(), safeSlug, session.userId]
    )

    return NextResponse.json({ organization: { id, name: name.trim(), slug: safeSlug } })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
