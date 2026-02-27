import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()
    const { searchParams } = new URL(request.url)

    const volunteer = searchParams.get('volunteer')
    const segment = searchParams.get('segment')
    const outcome = searchParams.get('outcome')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 100
    const offset = (page - 1) * limit

    let where = 'WHERE c.campaign_id = $1'
    const params: unknown[] = [ctx.campaignId]
    let paramIdx = 2

    if (volunteer) { where += ` AND c.user_id = $${paramIdx++}`; params.push(volunteer) }
    if (segment) { where += ` AND mr.segment = $${paramIdx++}`; params.push(segment) }
    if (outcome) { where += ` AND ai.contact_outcome = $${paramIdx++}`; params.push(outcome) }
    if (search) { where += ` AND (c.first_name || ' ' || c.last_name) LIKE $${paramIdx++}`; params.push(`%${search}%`) }

    const { rows: countRows } = await db.query(`
      SELECT COUNT(*) as c FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      ${where}
    `, params)
    const total = parseInt(countRows[0].c)

    const { rows: contacts } = await db.query(`
      SELECT c.*, u.name as volunteer_name, u.email as volunteer_email,
             mr.status as match_status, mr.best_match_data, mr.vote_score, mr.segment,
             ai.contacted, ai.contacted_date, ai.outreach_method, ai.contact_outcome, ai.notes,
             ai.is_volunteer_prospect, ai.volunteer_interest
      FROM contacts c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `, [...params, limit, offset])

    return NextResponse.json({ contacts, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
