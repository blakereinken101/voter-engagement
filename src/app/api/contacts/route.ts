import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import { fireAndForget, syncContactToVan } from '@/lib/van-sync'

export async function GET() {
  try {
    const ctx = await getRequestContext()

    const db = await getDb()

    const { rows: contacts } = await db.query(`
      SELECT c.*,
             mr.id as mr_id, mr.status as mr_status, mr.best_match_data, mr.candidates_data,
             mr.vote_score, mr.segment, mr.user_confirmed,
             ai.id as ai_id, ai.contacted, ai.contacted_date, ai.outreach_method,
             ai.contact_outcome, ai.follow_up_date, ai.notes,
             ai.is_volunteer_prospect, ai.recruited_date, ai.survey_responses
      FROM contacts c
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      WHERE c.user_id = $1 AND c.campaign_id = $2
      ORDER BY c.created_at ASC
    `, [ctx.userId, ctx.campaignId])

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
          surveyResponses: row.survey_responses ? JSON.parse(row.survey_responses as string) : undefined,
        }
      })

    return NextResponse.json({ personEntries, matchResults, actionPlanState })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[contacts GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { id, firstName, lastName, phone, address, city, zip, age, ageRange, gender, category } = body

    if (!firstName || typeof firstName !== 'string' || !lastName || typeof lastName !== 'string' || !category || typeof category !== 'string') {
      return NextResponse.json({ error: 'firstName, lastName, and category are required' }, { status: 400 })
    }

    // Sanitize string inputs
    const sanitize = (val: unknown, maxLen = 200): string | null =>
      typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) : null

    const db = await getDb()
    const contactId = id || crypto.randomUUID()

    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const safeAge = typeof age === 'number' && age >= 18 && age <= 120 ? Math.floor(age) : null
      const safeGender = (gender === 'M' || gender === 'F' || gender === '') ? gender : null
      const safeZip = typeof zip === 'string' ? zip.replace(/[^0-9]/g, '').slice(0, 5) : null

      await client.query(`
        INSERT INTO contacts (id, user_id, campaign_id, first_name, last_name, phone, address, city, zip, age, age_range, gender, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [contactId, ctx.userId, ctx.campaignId, sanitize(firstName, 50), sanitize(lastName, 50), sanitize(phone, 20) || null, sanitize(address, 200) || null, sanitize(city, 50) || null, safeZip || null, safeAge, sanitize(ageRange, 20) || null, safeGender || null, sanitize(category, 50)])

      await client.query(`
        INSERT INTO match_results (id, contact_id, status)
        VALUES ($1, $2, 'pending')
      `, [crypto.randomUUID(), contactId])

      await client.query(`
        INSERT INTO action_items (id, contact_id)
        VALUES ($1, $2)
      `, [crypto.randomUUID(), contactId])

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await logActivity(ctx.userId, 'add_contact', { contactId, name: `${firstName} ${lastName}` }, ctx.campaignId)

    fireAndForget(() => syncContactToVan(ctx.campaignId, contactId as string), `contact:${contactId}`)

    return NextResponse.json({ id: contactId, success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[contacts POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getRequestContext()

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    const db = await getDb()

    // Verify ownership + campaign
    const { rows } = await db.query('SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3', [contactId, ctx.userId, ctx.campaignId])
    if (!rows[0]) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // CASCADE deletes match_results and action_items
    await db.query('DELETE FROM contacts WHERE id = $1', [contactId])

    await logActivity(ctx.userId, 'remove_contact', { contactId }, ctx.campaignId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[contacts DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
