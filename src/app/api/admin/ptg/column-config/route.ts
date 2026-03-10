import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/column-config
 * Returns column visibility/order config from campaigns.settings.ptgColumns
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { rows } = await db.query(
      "SELECT COALESCE(settings->'ptgColumns', 'null'::jsonb) as cols FROM campaigns WHERE id = $1",
      [ctx.campaignId]
    )

    const columns = rows[0]?.cols || null
    return NextResponse.json({ columns })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * PUT /api/admin/ptg/column-config
 * Save column config to campaigns.settings.ptgColumns
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const body = await request.json()
    const { columns } = body

    if (!Array.isArray(columns)) {
      return NextResponse.json({ error: 'columns array required' }, { status: 400 })
    }

    await db.query(`
      UPDATE campaigns
      SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('ptgColumns', $1::jsonb)
      WHERE id = $2
    `, [JSON.stringify(columns), ctx.campaignId])

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
