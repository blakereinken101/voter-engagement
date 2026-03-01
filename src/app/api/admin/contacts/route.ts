import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { fireAndForget, syncContactToVan } from '@/lib/van-sync'

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

interface AdminContactInput {
  firstName: string
  lastName: string
  phone?: string
  city?: string
  address?: string
  category: string
  contactOutcome?: string
  volunteerInterest?: string
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = await getDb()

    let body: { targetUserId: string; contacts: AdminContactInput[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { targetUserId, contacts } = body

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'contacts array is required' }, { status: 400 })
    }
    if (contacts.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 contacts per request' }, { status: 400 })
    }

    // Validate target user is an active member of this campaign
    const { rows: memberRows } = await db.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND campaign_id = $2 AND is_active = true',
      [targetUserId, ctx.campaignId],
    )
    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Target user is not an active member of this campaign' }, { status: 400 })
    }

    const sanitize = (val: unknown, maxLen = 200): string | null =>
      typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) : null

    const VALID_OUTCOMES = ['supporter', 'undecided', 'opposed', 'left-message', 'no-answer']
    const VALID_VOLUNTEER = ['yes', 'no', 'maybe']

    const client = await db.connect()
    const createdIds: string[] = []

    try {
      await client.query('BEGIN')

      for (const c of contacts) {
        if (!c.firstName || !c.lastName || !c.category) continue

        const contactId = crypto.randomUUID()

        await client.query(`
          INSERT INTO contacts (id, user_id, campaign_id, first_name, last_name, phone, address, city, category)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [contactId, targetUserId, ctx.campaignId,
            sanitize(c.firstName, 50), sanitize(c.lastName, 50),
            sanitize(c.phone, 20) || null, sanitize(c.address, 200) || null,
            sanitize(c.city, 50) || null, sanitize(c.category, 50)])

        await client.query(`
          INSERT INTO match_results (id, contact_id, status) VALUES ($1, $2, 'pending')
        `, [crypto.randomUUID(), contactId])

        const safeOutcome = VALID_OUTCOMES.includes(c.contactOutcome as string) ? c.contactOutcome : null
        const safeVolunteer = VALID_VOLUNTEER.includes(c.volunteerInterest as string) ? c.volunteerInterest : null

        await client.query(`
          INSERT INTO action_items (id, contact_id, contact_outcome, volunteer_interest${safeOutcome ? ', contacted' : ''})
          VALUES ($1, $2, $3, $4${safeOutcome ? ', 1' : ''})
        `, [crypto.randomUUID(), contactId, safeOutcome, safeVolunteer])

        createdIds.push(contactId)
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await logActivity(ctx.userId, 'admin_bulk_add_contacts', {
      targetUserId,
      count: createdIds.length,
    }, ctx.campaignId)

    for (const contactId of createdIds) {
      fireAndForget(() => syncContactToVan(ctx.campaignId, contactId), `contact:${contactId}`)
    }

    return NextResponse.json({ success: true, count: createdIds.length, contactIds: createdIds })
  } catch (error: unknown) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
