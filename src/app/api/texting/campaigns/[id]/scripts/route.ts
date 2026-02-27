import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignAdmin, requireTextCampaignMember, mapScriptRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignMember(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()
    const url = new URL(request.url)
    const scriptType = url.searchParams.get('type')

    let query = 'SELECT * FROM text_campaign_scripts WHERE text_campaign_id = $1 AND is_active = true'
    const values: unknown[] = [params.id]

    if (scriptType) {
      query += ' AND script_type = $2'
      values.push(scriptType)
    }

    query += ' ORDER BY sort_order ASC, created_at ASC'

    const { rows } = await pool.query(query, values)
    return NextResponse.json({ scripts: rows.map(mapScriptRow) })
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
    const { scriptType, title, body: scriptBody, tags, sortOrder } = body

    if (!scriptBody?.trim()) {
      return NextResponse.json({ error: 'Script body is required' }, { status: 400 })
    }
    if (!['initial', 'canned_response'].includes(scriptType)) {
      return NextResponse.json({ error: 'Invalid script type' }, { status: 400 })
    }

    const pool = getPool()
    const id = crypto.randomUUID()

    await pool.query(
      `INSERT INTO text_campaign_scripts (id, text_campaign_id, script_type, title, body, tags, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, params.id, scriptType, title?.trim() || null, scriptBody.trim(), tags || [], sortOrder ?? 0]
    )

    const { rows } = await pool.query('SELECT * FROM text_campaign_scripts WHERE id = $1', [id])
    return NextResponse.json({ script: mapScriptRow(rows[0]) }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const body = await request.json()
    const { scriptId, title, body: scriptBody, tags, sortOrder, isActive } = body

    if (!scriptId) {
      return NextResponse.json({ error: 'scriptId is required' }, { status: 400 })
    }

    const pool = getPool()
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title?.trim() || null) }
    if (scriptBody !== undefined) { updates.push(`body = $${idx++}`); values.push(scriptBody.trim()) }
    if (tags !== undefined) { updates.push(`tags = $${idx++}`); values.push(tags) }
    if (sortOrder !== undefined) { updates.push(`sort_order = $${idx++}`); values.push(sortOrder) }
    if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(isActive) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    values.push(scriptId, params.id)
    await pool.query(
      `UPDATE text_campaign_scripts SET ${updates.join(', ')} WHERE id = $${idx++} AND text_campaign_id = $${idx}`,
      values
    )

    const { rows } = await pool.query('SELECT * FROM text_campaign_scripts WHERE id = $1', [scriptId])
    return NextResponse.json({ script: rows.length > 0 ? mapScriptRow(rows[0]) : null })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
