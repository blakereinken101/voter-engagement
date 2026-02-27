import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, mapCampaignRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

export async function GET() {
  try {
    const ctx = await getTextingContext()
    const pool = getPool()

    const { rows } = await pool.query(`
      SELECT tc.*,
        COUNT(tcc.id) AS contact_count,
        COUNT(tcc.id) FILTER (WHERE tcc.status = 'sent') AS sent_count,
        COUNT(tcc.id) FILTER (WHERE tcc.status = 'replied') AS replied_count,
        COUNT(tcc.id) FILTER (WHERE tcc.status = 'opted_out') AS opted_out_count
      FROM text_campaigns tc
      LEFT JOIN text_campaign_contacts tcc ON tcc.text_campaign_id = tc.id
      WHERE tc.organization_id = $1
      GROUP BY tc.id
      ORDER BY tc.created_at DESC
    `, [ctx.organizationId])

    return NextResponse.json({ campaigns: rows.map(mapCampaignRow) })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTextingContext()
    const body = await request.json()
    const { title, description, sendingMode, textingHoursStart, textingHoursEnd } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const pool = getPool()
    const campaignId = crypto.randomUUID()
    const settingsId = crypto.randomUUID()

    await pool.query(
      `INSERT INTO text_campaigns (id, organization_id, title, description, sending_mode, texting_hours_start, texting_hours_end, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        campaignId,
        ctx.organizationId,
        title.trim(),
        description?.trim() || null,
        sendingMode || 'p2p',
        textingHoursStart ?? 9,
        textingHoursEnd ?? 21,
        ctx.userId,
      ]
    )

    // Create default settings
    await pool.query(
      `INSERT INTO text_campaign_settings (id, text_campaign_id) VALUES ($1, $2)`,
      [settingsId, campaignId]
    )

    // Add creator as campaign admin
    await pool.query(
      `INSERT INTO text_campaign_members (id, text_campaign_id, user_id, role)
       VALUES ($1, $2, $3, 'admin')`,
      [crypto.randomUUID(), campaignId, ctx.userId]
    )

    const { rows } = await pool.query('SELECT * FROM text_campaigns WHERE id = $1', [campaignId])
    return NextResponse.json({ campaign: mapCampaignRow(rows[0]) }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
