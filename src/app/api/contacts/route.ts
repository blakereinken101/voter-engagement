import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET() {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const db = getDb()

    const contacts = db.prepare(`
      SELECT c.*,
             mr.id as mr_id, mr.status as mr_status, mr.best_match_data, mr.candidates_data,
             mr.vote_score, mr.segment, mr.user_confirmed,
             ai.id as ai_id, ai.contacted, ai.contacted_date, ai.outreach_method,
             ai.contact_outcome, ai.follow_up_date, ai.notes,
             ai.is_volunteer_prospect, ai.recruited_date
      FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE c.user_id = ?
      ORDER BY c.created_at ASC
    `).all(session.userId) as Record<string, unknown>[]

    // Transform DB rows back to the client-side state shape
    const personEntries = contacts.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone || undefined,
      address: row.address || undefined,
      city: row.city || undefined,
      zip: row.zip || undefined,
      age: row.age || undefined,
      ageRange: row.age_range || undefined,
      gender: row.gender || undefined,
      category: row.category,
    }))

    const matchResults = contacts
      .filter((row) => row.mr_id)
      .map((row) => ({
        personEntry: personEntries.find((p) => p.id === row.id),
        status: row.mr_status,
        bestMatch: row.best_match_data ? JSON.parse(row.best_match_data as string) : undefined,
        candidates: row.candidates_data ? JSON.parse(row.candidates_data as string) : [],
        voteScore: row.vote_score ?? undefined,
        segment: row.segment || undefined,
        userConfirmed: !!row.user_confirmed,
      }))

    const actionPlanState = contacts
      .filter((row) => row.ai_id)
      .map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchResult = matchResults.find((mr: any) =>
          mr.personEntry?.id === row.id
        ) || {
          personEntry: personEntries.find((p) => p.id === row.id),
          status: 'pending',
          candidates: [],
        }
        return {
          matchResult,
          contacted: !!row.contacted,
          contactedDate: row.contacted_date || undefined,
          outreachMethod: row.outreach_method || undefined,
          contactOutcome: row.contact_outcome || undefined,
          followUpDate: row.follow_up_date || undefined,
          notes: row.notes || undefined,
          isVolunteerProspect: !!row.is_volunteer_prospect,
          recruitedDate: row.recruited_date || undefined,
        }
      })

    return NextResponse.json({ personEntries, matchResults, actionPlanState })
  } catch (error) {
    console.error('[contacts GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { id, firstName, lastName, phone, address, city, zip, age, ageRange, gender, category } = body

    if (!firstName || !lastName || !category) {
      return NextResponse.json({ error: 'firstName, lastName, and category are required' }, { status: 400 })
    }

    const db = getDb()
    const contactId = id || crypto.randomUUID()

    const insertContact = db.prepare(`
      INSERT INTO contacts (id, user_id, first_name, last_name, phone, address, city, zip, age, age_range, gender, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMatchResult = db.prepare(`
      INSERT INTO match_results (id, contact_id, status)
      VALUES (?, ?, 'pending')
    `)

    const insertActionItem = db.prepare(`
      INSERT INTO action_items (id, contact_id)
      VALUES (?, ?)
    `)

    const transaction = db.transaction(() => {
      insertContact.run(contactId, session.userId, firstName, lastName, phone || null, address || null, city || null, zip || null, age || null, ageRange || null, gender || null, category)
      insertMatchResult.run(crypto.randomUUID(), contactId)
      insertActionItem.run(crypto.randomUUID(), contactId)
    })

    transaction()

    logActivity(db, session.userId, 'add_contact', { contactId, name: `${firstName} ${lastName}` })

    return NextResponse.json({ id: contactId, success: true })
  } catch (error) {
    console.error('[contacts POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    const db = getDb()

    // Verify ownership
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?').get(contactId, session.userId)
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // CASCADE deletes match_results and action_items
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId)

    logActivity(db, session.userId, 'remove_contact', { contactId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contacts DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
