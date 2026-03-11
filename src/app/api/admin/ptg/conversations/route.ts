import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb, logActivity } from '@/lib/db'
import { dispatchWebhook } from '@/lib/webhook-dispatch'

/**
 * GET /api/admin/ptg/conversations
 * Server-side filtered, sorted, paginated conversations spreadsheet.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    // Check if match_results has the 'confidence' column (migration 014)
    let hasConfidenceCol = false
    try {
      const { rows: colCheck } = await db.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'match_results' AND column_name = 'confidence'
      `)
      hasConfidenceCol = colCheck.length > 0
    } catch { /* ignore */ }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '100')))
    const search = searchParams.get('search') || ''
    const region = searchParams.get('region') || ''
    const organizerId = searchParams.get('organizerId') || ''
    const volunteerId = searchParams.get('volunteerId') || ''
    const outcome = searchParams.get('outcome') || ''
    const entryMethod = searchParams.get('entryMethod') || ''
    const matchStatus = searchParams.get('matchStatus') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const sortBy = searchParams.get('sortBy') || 'timestamp'
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC'

    // Build WHERE clauses
    const conditions: string[] = ['c.campaign_id = $1']
    const params: unknown[] = [ctx.campaignId]
    let idx = 2

    if (search) {
      conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.address ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }

    if (region) {
      conditions.push(`COALESCE(t.region, org_m.region) = $${idx}`)
      params.push(region)
      idx++
    }

    if (organizerId) {
      conditions.push(`COALESCE(t.organizer_id, c.user_id) = $${idx}`)
      params.push(organizerId)
      idx++
    }

    if (volunteerId) {
      conditions.push(`c.user_id = $${idx}`)
      params.push(volunteerId)
      idx++
    }

    if (outcome) {
      conditions.push(`ai.contact_outcome = $${idx}`)
      params.push(outcome)
      idx++
    }

    if (entryMethod) {
      conditions.push(`COALESCE(c.entry_method, 'manual') = $${idx}`)
      params.push(entryMethod)
      idx++
    }

    if (matchStatus) {
      conditions.push(`COALESCE(mr.status, 'pending') = $${idx}`)
      params.push(matchStatus)
      idx++
    }

    if (dateFrom) {
      conditions.push(`COALESCE(ai.contacted_date, c.created_at::text) >= $${idx}`)
      params.push(dateFrom)
      idx++
    }

    if (dateTo) {
      conditions.push(`COALESCE(ai.contacted_date, c.created_at::text) <= $${idx}`)
      params.push(dateTo)
      idx++
    }

    const where = conditions.join(' AND ')

    // Allowed sort columns mapping
    const sortColumns: Record<string, string> = {
      timestamp: 'COALESCE(ai.updated_at, c.created_at)',
      name: 'c.last_name',
      outcome: 'ai.contact_outcome',
      volunteer: 'vol.name',
      organizer: 'org_u.name',
      region: 'COALESCE(t.region, org_m.region)',
      entryMethod: 'c.entry_method',
      matchStatus: 'mr.status',
    }
    const orderCol = sortColumns[sortBy] || sortColumns.timestamp

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN users vol ON vol.id = c.user_id
      LEFT JOIN memberships vol_m ON vol_m.user_id = c.user_id AND vol_m.campaign_id = c.campaign_id
      LEFT JOIN users org_u ON org_u.id = vol_m.organizer_id
      LEFT JOIN memberships org_m ON org_m.user_id = vol_m.organizer_id AND org_m.campaign_id = c.campaign_id
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      WHERE ${where}
    `
    const { rows: countRows } = await db.query(countQuery, params)
    const total = parseInt(countRows[0].total)

    // Fetch page
    const offset = (page - 1) * pageSize
    const dataQuery = `
      SELECT
        c.id as contact_id,
        c.first_name,
        c.last_name,
        c.phone,
        c.address,
        c.city,
        c.zip,
        ai.id as action_item_id,
        ai.contact_outcome,
        ai.notes,
        ai.survey_responses,
        ai.outreach_method,
        ai.contacted_date,
        ai.volunteer_interest,
        vol.name as volunteer_name,
        vol.id as volunteer_id,
        org_u.name as organizer_name,
        org_u.id as organizer_id,
        t.name as turf_name,
        COALESCE(t.region, org_m.region) as region,
        COALESCE(c.entry_method, 'manual') as entry_method,
        entered_u.name as entered_by_name,
        c.entered_by as entered_by_id,
        c.user_id as owner_id,
        COALESCE(ai.updated_at, c.created_at) as timestamp,
        camp.timezone,
        mr.status as match_status,
        ${hasConfidenceCol ? 'mr.confidence' : 'NULL'} as match_confidence,
        mr.vote_score,
        mr.segment
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN users vol ON vol.id = c.user_id
      LEFT JOIN memberships vol_m ON vol_m.user_id = c.user_id AND vol_m.campaign_id = c.campaign_id
      LEFT JOIN users org_u ON org_u.id = vol_m.organizer_id
      LEFT JOIN memberships org_m ON org_m.user_id = vol_m.organizer_id AND org_m.campaign_id = c.campaign_id
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN users entered_u ON entered_u.id = c.entered_by
      LEFT JOIN campaigns camp ON camp.id = c.campaign_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      WHERE ${where}
      ORDER BY ${orderCol} ${sortDir}
      LIMIT $${idx} OFFSET $${idx + 1}
    `
    params.push(pageSize, offset)

    const { rows } = await db.query(dataQuery, params)

    const mapped = rows.map((r: Record<string, unknown>) => {
      let surveyResponses = null
      if (r.survey_responses) {
        try {
          surveyResponses = typeof r.survey_responses === 'string'
            ? JSON.parse(r.survey_responses)
            : r.survey_responses
        } catch { /* ignore */ }
      }

      return {
        contactId: r.contact_id,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone || null,
        address: r.address || null,
        city: r.city || null,
        zip: r.zip || null,
        actionItemId: r.action_item_id || null,
        contactOutcome: r.contact_outcome || null,
        notes: r.notes || null,
        surveyResponses,
        outreachMethod: r.outreach_method || null,
        contactedDate: r.contacted_date || null,
        volunteerInterest: r.volunteer_interest || null,
        volunteerName: r.volunteer_name || null,
        volunteerId: r.volunteer_id || null,
        organizerName: r.organizer_name || null,
        organizerId: r.organizer_id || null,
        turfName: r.turf_name || null,
        region: r.region || null,
        entryMethod: r.entry_method || 'manual',
        enteredByName: r.entered_by_name || null,
        enteredBySelf: r.entered_by_id === r.owner_id || !r.entered_by_id,
        timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : null,
        timezone: r.timezone || 'America/New_York',
        matchStatus: r.match_status || null,
        matchConfidence: r.match_confidence || null,
        voteScore: r.vote_score != null ? Number(r.vote_score) : null,
        segment: r.segment || null,
      }
    })

    return NextResponse.json({
      rows: mapped,
      total,
      page,
      pageSize,
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/**
 * PATCH /api/admin/ptg/conversations
 * Inline-edit a single field on a contact or action_item.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const body = await request.json()
    const { contactId, field, value } = body

    if (!contactId || !field) {
      return NextResponse.json({ error: 'contactId and field are required' }, { status: 400 })
    }

    // Verify contact belongs to this campaign
    const { rows: check } = await db.query(
      'SELECT id, user_id FROM contacts WHERE id = $1 AND campaign_id = $2',
      [contactId, ctx.campaignId]
    )
    if (check.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Reassign organizer: changes the volunteer's organizer assignment
    if (field === 'reassign_organizer') {
      const volunteerId = check[0].user_id
      await db.query(
        'UPDATE memberships SET organizer_id = $1 WHERE user_id = $2 AND campaign_id = $3',
        [value || null, volunteerId, ctx.campaignId],
      )
      await logActivity(ctx.userId, 'volunteer_reassigned_inline', {
        contactId,
        volunteerId,
        newOrganizerId: value || null,
      }, ctx.campaignId)
      return NextResponse.json({ ok: true })
    }

    // Map field to table + column
    const contactFields: Record<string, string> = {
      first_name: 'first_name',
      last_name: 'last_name',
      phone: 'phone',
      address: 'address',
      city: 'city',
      zip: 'zip',
    }

    const actionFields: Record<string, string> = {
      contact_outcome: 'contact_outcome',
      notes: 'notes',
      survey_responses: 'survey_responses',
      volunteer_interest: 'volunteer_interest',
      outreach_method: 'outreach_method',
      contacted_date: 'contacted_date',
    }

    if (contactFields[field]) {
      await db.query(
        `UPDATE contacts SET ${contactFields[field]} = $1 WHERE id = $2`,
        [value, contactId]
      )
    } else if (actionFields[field]) {
      const dbValue = field === 'survey_responses' && typeof value === 'object'
        ? JSON.stringify(value)
        : value

      // Upsert action_item
      await db.query(`
        INSERT INTO action_items (id, contact_id, ${actionFields[field]}, updated_at)
        VALUES (gen_random_uuid()::text, $1, $2, NOW())
        ON CONFLICT (contact_id)
        DO UPDATE SET ${actionFields[field]} = $2, updated_at = NOW()
      `, [contactId, dbValue])
    } else {
      return NextResponse.json({ error: `Unknown field: ${field}` }, { status: 400 })
    }

    dispatchWebhook(ctx.campaignId, 'contact.updated', { contactId, field, value })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
