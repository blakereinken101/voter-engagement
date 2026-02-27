import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignAdmin, requireTextCampaignMember, mapTagRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignMember(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT * FROM text_campaign_tags WHERE text_campaign_id = $1 ORDER BY name ASC',
      [params.id]
    )

    return NextResponse.json({ tags: rows.map(mapTagRow) })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const body = await request.json()
    const { name, color } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const pool = getPool()
    const id = crypto.randomUUID()

    await pool.query(
      `INSERT INTO text_campaign_tags (id, text_campaign_id, name, color)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (text_campaign_id, name) DO NOTHING`,
      [id, params.id, name.trim(), color || '#6C3CE1']
    )

    const { rows } = await pool.query(
      'SELECT * FROM text_campaign_tags WHERE text_campaign_id = $1 AND name = $2',
      [params.id, name.trim()]
    )

    return NextResponse.json({ tag: mapTagRow(rows[0]) }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
