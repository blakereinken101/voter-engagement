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
    if (body.contacts.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5,000 contacts per request' }, { status: 400 })
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

    // Validate and filter contacts first (no DB calls in the loop)
    const toInsert: { firstName: string; lastName: string; cell: string; customFields: string }[] = []

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

      toInsert.push({
        firstName: c.firstName.trim(),
        lastName: c.lastName.trim(),
        cell: normalized,
        customFields: JSON.stringify(c.customFields || {}),
      })
      existingPhones.add(normalized)
    }

    // Batch insert in chunks of 200 (single query per batch instead of N+1)
    const BATCH_SIZE = 200
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const values: unknown[] = []
      const placeholders: string[] = []
      let idx = 1

      for (const row of batch) {
        placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
        values.push(crypto.randomUUID(), params.id, row.firstName, row.lastName, row.cell, row.customFields)
      }

      await pool.query(
        `INSERT INTO text_campaign_contacts (id, text_campaign_id, first_name, last_name, cell, custom_fields)
         VALUES ${placeholders.join(', ')}`,
        values
      )
      imported += batch.length
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
