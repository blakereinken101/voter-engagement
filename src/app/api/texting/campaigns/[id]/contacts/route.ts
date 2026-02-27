import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, requireTextCampaignAdmin, normalizeToE164, mapContactRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'
import type { ImportContactsBody } from '@/types/texting'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTextingContext()
    const pool = getPool()
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const assignedTo = url.searchParams.get('assignedTo')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)
    const offset = (page - 1) * limit

    let where = 'WHERE tcc.text_campaign_id = $1'
    const values: unknown[] = [params.id]
    let idx = 2

    if (status) { where += ` AND tcc.status = $${idx++}`; values.push(status) }
    if (assignedTo) { where += ` AND tcc.assigned_to = $${idx++}`; values.push(assignedTo) }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM text_campaign_contacts tcc ${where}`, values
    )
    const total = parseInt(countRows[0].count, 10)

    values.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT tcc.* FROM text_campaign_contacts tcc ${where} ORDER BY tcc.created_at ASC LIMIT $${idx++} OFFSET $${idx}`,
      values
    )

    return NextResponse.json({
      contacts: rows.map(mapContactRow),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
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

    const body: ImportContactsBody = await request.json()
    if (!body.contacts?.length) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
    }

    const pool = getPool()

    // Get existing contacts' phones for dedup
    const { rows: existingRows } = await pool.query(
      'SELECT cell FROM text_campaign_contacts WHERE text_campaign_id = $1',
      [params.id]
    )
    const existingPhones = new Set(existingRows.map((r: { cell: string }) => r.cell))

    // Get org-level opt-outs
    const { rows: optOutRows } = await pool.query(
      'SELECT phone FROM text_opt_outs WHERE organization_id = $1',
      [ctx.organizationId]
    )
    const optedOutPhones = new Set(optOutRows.map((r: { phone: string }) => r.phone))

    let imported = 0
    let skippedDuplicate = 0
    let skippedInvalid = 0
    let skippedOptOut = 0

    for (const c of body.contacts) {
      if (!c.firstName?.trim() || !c.lastName?.trim() || !c.cell?.trim()) {
        skippedInvalid++
        continue
      }

      const normalized = normalizeToE164(c.cell)
      if (!normalized) {
        skippedInvalid++
        continue
      }

      if (existingPhones.has(normalized)) {
        skippedDuplicate++
        continue
      }

      if (optedOutPhones.has(normalized)) {
        skippedOptOut++
        continue
      }

      await pool.query(
        `INSERT INTO text_campaign_contacts (id, text_campaign_id, first_name, last_name, cell, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          params.id,
          c.firstName.trim(),
          c.lastName.trim(),
          normalized,
          JSON.stringify(c.customFields || {}),
        ]
      )
      existingPhones.add(normalized)
      imported++
    }

    return NextResponse.json({
      imported,
      skippedDuplicate,
      skippedInvalid,
      skippedOptOut,
      total: body.contacts.length,
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
