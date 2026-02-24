import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'

export async function GET() {
  try {
    await requirePlatformAdmin()
    const db = await getDb()

    const { rows } = await db.query(`
      SELECT
        ps.*,
        o.name as organization_name,
        o.slug as organization_slug
      FROM product_subscriptions ps
      JOIN organizations o ON o.id = ps.organization_id
      ORDER BY ps.created_at DESC
    `)

    return NextResponse.json({ subscriptions: rows })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
