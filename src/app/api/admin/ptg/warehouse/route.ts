import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

/**
 * GET /api/admin/ptg/warehouse
 * Paginated data export in JSON for ETL / BigQuery sync.
 * Supports incremental sync via `since` param.
 * Params: since (ISO timestamp), limit (max 10000), offset
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') || ''
    const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get('limit') || '1000')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))

    const conditions: string[] = ['c.campaign_id = $1']
    const params: unknown[] = [ctx.campaignId]
    let idx = 2

    if (since) {
      conditions.push(`GREATEST(COALESCE(ai.updated_at, c.created_at), c.created_at) >= $${idx}`)
      params.push(since)
      idx++
    }

    const where = conditions.join(' AND ')

    const { rows: countRows } = await db.query(`
      SELECT COUNT(*) as total
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE ${where}
    `, params)
    const total = parseInt(countRows[0].total)

    params.push(limit, offset)

    const { rows } = await db.query(`
      SELECT
        c.id as contact_id,
        c.first_name,
        c.last_name,
        c.phone,
        c.address,
        c.city,
        c.zip,
        c.created_at as contact_created_at,
        c.user_id as volunteer_id,
        COALESCE(c.entry_method, 'manual') as entry_method,
        ai.id as action_item_id,
        ai.contact_outcome,
        ai.notes,
        ai.survey_responses,
        ai.outreach_method,
        ai.contacted_date,
        ai.volunteer_interest,
        ai.updated_at as action_updated_at,
        vol.name as volunteer_name,
        vol.email as volunteer_email,
        org_u.id as organizer_id,
        org_u.name as organizer_name,
        t.name as turf_name,
        COALESCE(t.region, org_m.region) as region,
        mr.status as match_status,
        mr.confidence as match_confidence,
        mr.vote_score,
        mr.segment,
        mr.best_match_data
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN users vol ON vol.id = c.user_id
      LEFT JOIN memberships vol_m ON vol_m.user_id = c.user_id AND vol_m.campaign_id = c.campaign_id
      LEFT JOIN users org_u ON org_u.id = vol_m.organizer_id
      LEFT JOIN memberships org_m ON org_m.user_id = vol_m.organizer_id AND org_m.campaign_id = c.campaign_id
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      WHERE ${where}
      ORDER BY GREATEST(COALESCE(ai.updated_at, c.created_at), c.created_at) ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params)

    const records = rows.map((r: Record<string, unknown>) => {
      let surveyResponses = null
      if (r.survey_responses) {
        try {
          surveyResponses = typeof r.survey_responses === 'string'
            ? JSON.parse(r.survey_responses)
            : r.survey_responses
        } catch { /* ignore */ }
      }

      let bestMatchData = null
      if (r.best_match_data) {
        try {
          bestMatchData = typeof r.best_match_data === 'string'
            ? JSON.parse(r.best_match_data)
            : r.best_match_data
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
        contactCreatedAt: r.contact_created_at ? new Date(r.contact_created_at as string).toISOString() : null,
        entryMethod: r.entry_method,
        volunteerId: r.volunteer_id,
        volunteerName: r.volunteer_name || null,
        volunteerEmail: r.volunteer_email || null,
        organizerId: r.organizer_id || null,
        organizerName: r.organizer_name || null,
        turfName: r.turf_name || null,
        region: r.region || null,
        actionItemId: r.action_item_id || null,
        contactOutcome: r.contact_outcome || null,
        notes: r.notes || null,
        surveyResponses,
        outreachMethod: r.outreach_method || null,
        contactedDate: r.contacted_date || null,
        volunteerInterest: r.volunteer_interest || null,
        actionUpdatedAt: r.action_updated_at ? new Date(r.action_updated_at as string).toISOString() : null,
        matchStatus: r.match_status || null,
        matchConfidence: r.match_confidence || null,
        voteScore: r.vote_score != null ? Number(r.vote_score) : null,
        segment: r.segment || null,
        bestMatchData,
      }
    })

    return NextResponse.json({
      records,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      syncTimestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
