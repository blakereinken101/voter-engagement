import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const { rows } = await db.query(`
      SELECT
        o.*,
        COUNT(DISTINCT c.id)::int as campaign_count,
        COUNT(DISTINCT m.user_id)::int as user_count,
        ps.plan as subscription_plan,
        ps.status as subscription_status
      FROM organizations o
      LEFT JOIN campaigns c ON c.org_id = o.id
      LEFT JOIN memberships m ON m.campaign_id = c.id AND m.is_active = true
      LEFT JOIN product_subscriptions ps ON ps.organization_id = o.id AND ps.product = 'events'
      GROUP BY o.id, ps.plan, ps.status
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
