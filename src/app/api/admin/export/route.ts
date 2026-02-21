import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

function escapeCSV(val: string | null | undefined): string {
  if (!val) return ''
  const s = String(val)
  if (s.match(/^[=+\-@\t\r]/)) return "'" + s
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export async function GET(request: NextRequest) {
  try {
    requireAdmin()
    const db = await getDb()
    const { searchParams } = new URL(request.url)

    const volunteer = searchParams.get('volunteer')
    const segment = searchParams.get('segment')
    const outcome = searchParams.get('outcome')

    let where = 'WHERE 1=1'
    const params: unknown[] = []
    let paramIdx = 1
    if (volunteer) { where += ` AND c.user_id = $${paramIdx++}`; params.push(volunteer) }
    if (segment) { where += ` AND mr.segment = $${paramIdx++}`; params.push(segment) }
    if (outcome) { where += ` AND ai.contact_outcome = $${paramIdx++}`; params.push(outcome) }

    const { rows } = await db.query(`
      SELECT c.*, u.name as volunteer_name,
             mr.status as match_status, mr.best_match_data, mr.vote_score, mr.segment,
             ai.contacted, ai.contacted_date, ai.outreach_method, ai.contact_outcome, ai.notes,
             ai.is_volunteer_prospect
      FROM contacts c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      ${where}
      ORDER BY c.created_at DESC
    `, params)

    const headers = ['Volunteer','First Name','Last Name','Phone','Category','City','Zip','Match Status','Party','Vote Score','Segment','Outreach Method','Outcome','Notes','Volunteer Prospect','Contact Date','Created']
    const csvLines = [headers.join(',')]

    for (const r of rows) {
      let party = ''
      if (r.best_match_data) {
        try { party = JSON.parse(r.best_match_data as string).party_affiliation || '' } catch {}
      }
      csvLines.push([
        escapeCSV(r.volunteer_name as string),
        escapeCSV(r.first_name as string),
        escapeCSV(r.last_name as string),
        escapeCSV(r.phone as string),
        escapeCSV(r.category as string),
        escapeCSV(r.city as string),
        escapeCSV(r.zip as string),
        escapeCSV(r.match_status as string),
        escapeCSV(party),
        r.vote_score != null ? String(Math.round((r.vote_score as number) * 100)) + '%' : '',
        escapeCSV(r.segment as string),
        escapeCSV(r.outreach_method as string),
        escapeCSV(r.contact_outcome as string),
        escapeCSV(r.notes as string),
        r.is_volunteer_prospect ? 'Yes' : '',
        escapeCSV(r.contacted_date as string),
        escapeCSV(r.created_at as string),
      ].join(','))
    }

    const csv = csvLines.join('\n')
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=votecircle-export-${date}.csv`,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
