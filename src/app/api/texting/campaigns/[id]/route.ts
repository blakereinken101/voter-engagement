import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignAdmin, requireTextCampaignMember, mapCampaignRow, mapSettingsRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignMember(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()
    const { rows: campaignRows } = await pool.query(`
      SELECT tc.*,
        COUNT(tcc.id) AS contact_count,
        COUNT(tcc.id) FILTER (WHERE tcc.status = 'sent') AS sent_count,
        COUNT(tcc.id) FILTER (WHERE tcc.status = 'replied') AS replied_count,
        COUNT(tcc.id) FILTER (WHERE tcc.status = 'opted_out') AS opted_out_count
      FROM text_campaigns tc
      LEFT JOIN text_campaign_contacts tcc ON tcc.text_campaign_id = tc.id
      WHERE tc.id = $1 AND tc.organization_id = $2
      GROUP BY tc.id
    `, [params.id, ctx.organizationId])

    if (campaignRows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { rows: settingsRows } = await pool.query(
      'SELECT * FROM text_campaign_settings WHERE text_campaign_id = $1',
      [params.id]
    )

    return NextResponse.json({
      campaign: mapCampaignRow(campaignRows[0]),
      settings: settingsRows.length > 0 ? mapSettingsRow(settingsRows[0]) : null,
    })
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
    const pool = getPool()

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (body.title !== undefined) { updates.push(`title = $${idx++}`); values.push(body.title.trim()) }
    if (body.description !== undefined) { updates.push(`description = $${idx++}`); values.push(body.description?.trim() || null) }
    if (body.status !== undefined) { updates.push(`status = $${idx++}`); values.push(body.status) }
    if (body.sendingMode !== undefined) { updates.push(`sending_mode = $${idx++}`); values.push(body.sendingMode) }
    if (body.textingHoursStart !== undefined) { updates.push(`texting_hours_start = $${idx++}`); values.push(body.textingHoursStart) }
    if (body.textingHoursEnd !== undefined) { updates.push(`texting_hours_end = $${idx++}`); values.push(body.textingHoursEnd) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(params.id)

    await pool.query(
      `UPDATE text_campaigns SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    )

    const { rows } = await pool.query('SELECT * FROM text_campaigns WHERE id = $1', [params.id])
    return NextResponse.json({ campaign: mapCampaignRow(rows[0]) })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    await requireTextCampaignAdmin(params.id, ctx.userId, ctx.isPlatformAdmin)

    const pool = getPool()
    await pool.query(
      `UPDATE text_campaigns SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [params.id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
