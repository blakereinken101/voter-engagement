import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    requireAdmin()
    const db = getDb()
    const { searchParams } = new URL(request.url)

    const volunteer = searchParams.get('volunteer')
    const segment = searchParams.get('segment')
    const outcome = searchParams.get('outcome')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 100
    const offset = (page - 1) * limit

    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (volunteer) { where += ' AND c.user_id = ?'; params.push(volunteer) }
    if (segment) { where += ' AND mr.segment = ?'; params.push(segment) }
    if (outcome) { where += ' AND ai.contact_outcome = ?'; params.push(outcome) }
    if (search) { where += " AND (c.first_name || ' ' || c.last_name) LIKE ?"; params.push(`%${search}%`) }

    const total = (db.prepare(`
      SELECT COUNT(*) as c FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      ${where}
    `).get(...params) as {c:number}).c

    const contacts = db.prepare(`
      SELECT c.*, u.name as volunteer_name, u.email as volunteer_email,
             mr.status as match_status, mr.best_match_data, mr.vote_score, mr.segment,
             ai.contacted, ai.contacted_date, ai.outreach_method, ai.contact_outcome, ai.notes,
             ai.is_volunteer_prospect
      FROM contacts c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    return NextResponse.json({ contacts, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
