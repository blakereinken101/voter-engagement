import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { getDb } from '@/lib/db'

function escapeCSV(val: string | null | undefined): string {
  if (!val) return ''
  const s = String(val)
  if (s.match(/^[=+\-@\t\r]/)) return "'" + s
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/**
 * GET /api/admin/ptg/export
 * Export PTG conversations as CSV, respecting all filters.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const region = searchParams.get('region') || ''
    const organizerId = searchParams.get('organizerId') || ''
    const volunteerId = searchParams.get('volunteerId') || ''
    const outcome = searchParams.get('outcome') || ''
    const entryMethod = searchParams.get('entryMethod') || ''
    const matchStatus = searchParams.get('matchStatus') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    // Check if match_results has 'confidence' column (migration 014)
    let hasConfidenceCol = false
    try {
      const { rows: colCheck } = await db.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'match_results' AND column_name = 'confidence'
      `)
      hasConfidenceCol = colCheck.length > 0
    } catch { /* ignore */ }

    const conditions: string[] = ['c.campaign_id = $1']
    const params: unknown[] = [ctx.campaignId]
    let idx = 2

    if (search) {
      conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.address ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }
    if (region) { conditions.push(`COALESCE(t.region, org_m.region) = $${idx}`); params.push(region); idx++ }
    if (organizerId) { conditions.push(`COALESCE(t.organizer_id, c.user_id) = $${idx}`); params.push(organizerId); idx++ }
    if (volunteerId) { conditions.push(`c.user_id = $${idx}`); params.push(volunteerId); idx++ }
    if (outcome) { conditions.push(`ai.contact_outcome = $${idx}`); params.push(outcome); idx++ }
    if (entryMethod) { conditions.push(`COALESCE(c.entry_method, 'manual') = $${idx}`); params.push(entryMethod); idx++ }
    if (matchStatus) { conditions.push(`COALESCE(mr.status, 'pending') = $${idx}`); params.push(matchStatus); idx++ }
    if (dateFrom) { conditions.push(`COALESCE(ai.contacted_date, c.created_at::text) >= $${idx}`); params.push(dateFrom); idx++ }
    if (dateTo) { conditions.push(`COALESCE(ai.contacted_date, c.created_at::text) <= $${idx}`); params.push(dateTo); idx++ }

    const where = conditions.join(' AND ')

    const { rows } = await db.query(`
      SELECT
        vol.name as volunteer_name,
        c.first_name, c.last_name, c.phone, c.address, c.city, c.zip,
        ai.contact_outcome, ai.notes, ai.outreach_method, ai.contacted_date,
        ai.volunteer_interest, ai.survey_responses,
        org_u.name as organizer_name,
        COALESCE(t.region, org_m.region) as region,
        t.name as turf_name,
        COALESCE(c.entry_method, 'manual') as entry_method,
        mr.status as match_status, ${hasConfidenceCol ? 'mr.confidence' : 'NULL'} as match_confidence,
        mr.vote_score, mr.segment,
        COALESCE(ai.updated_at, c.created_at) as timestamp
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN users vol ON vol.id = c.user_id
      LEFT JOIN memberships vol_m ON vol_m.user_id = c.user_id AND vol_m.campaign_id = c.campaign_id
      LEFT JOIN users org_u ON org_u.id = vol_m.organizer_id
      LEFT JOIN memberships org_m ON org_m.user_id = vol_m.organizer_id AND org_m.campaign_id = c.campaign_id
      LEFT JOIN turfs t ON t.id = c.turf_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      WHERE ${where}
      ORDER BY COALESCE(ai.updated_at, c.created_at) DESC
      LIMIT 100000
    `, params)

    const headers = [
      'Volunteer', 'First Name', 'Last Name', 'Phone', 'Address', 'City', 'Zip',
      'Outcome', 'Notes', 'Outreach', 'Vol. Interest', 'Survey',
      'Organizer', 'Region', 'Turf', 'Entry Method',
      'Match Status', 'Confidence', 'Vote Score', 'Segment',
      'Date',
    ]
    const csvLines = [headers.join(',')]

    for (const r of rows) {
      let surveyText = ''
      if (r.survey_responses) {
        try {
          const parsed = typeof r.survey_responses === 'string' ? JSON.parse(r.survey_responses) : r.survey_responses
          surveyText = Object.entries(parsed).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ')
        } catch { /* ignore */ }
      }

      csvLines.push([
        escapeCSV(r.volunteer_name as string),
        escapeCSV(r.first_name as string),
        escapeCSV(r.last_name as string),
        escapeCSV(r.phone as string),
        escapeCSV(r.address as string),
        escapeCSV(r.city as string),
        escapeCSV(r.zip as string),
        escapeCSV(r.contact_outcome as string),
        escapeCSV(r.notes as string),
        escapeCSV(r.outreach_method as string),
        escapeCSV(r.volunteer_interest as string),
        escapeCSV(surveyText),
        escapeCSV(r.organizer_name as string),
        escapeCSV(r.region as string),
        escapeCSV(r.turf_name as string),
        escapeCSV(r.entry_method as string),
        escapeCSV(r.match_status as string),
        escapeCSV(r.match_confidence as string),
        r.vote_score != null ? String(Math.round((r.vote_score as number) * 100)) + '%' : '',
        escapeCSV(r.segment as string),
        escapeCSV(r.timestamp as string),
      ].join(','))
    }

    const csv = csvLines.join('\n')
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=ptg-conversations-${date}.csv`,
      },
    })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
