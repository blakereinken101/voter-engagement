import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { contactId: string } }) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { contactId } = params
    if (!contactId || typeof contactId !== 'string' || contactId.length > 100) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const db = await getDb()

    // Verify ownership
    const { rows } = await db.query('SELECT id FROM contacts WHERE id = $1 AND user_id = $2', [contactId, session.userId])
    if (!rows[0]) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // Valid enum values
    const VALID_OUTREACH = ['text', 'call', 'in-person', 'social-media', 'email', null]
    const VALID_OUTCOMES = ['great-conversation', 'left-message', 'no-answer', 'not-interested', 'moved', 'wrong-number', 'pledged-to-vote', 'already-voted', 'needs-follow-up', null]

    // Build dynamic update
    const updates: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if ('contacted' in body) {
      updates.push(`contacted = $${paramIdx++}`)
      values.push(body.contacted ? 1 : 0)
      if (body.contacted) {
        updates.push(`contacted_date = $${paramIdx++}`)
        values.push(new Date().toISOString())
      }
    }
    if ('outreachMethod' in body) {
      if (!VALID_OUTREACH.includes(body.outreachMethod as string | null)) {
        return NextResponse.json({ error: 'Invalid outreach method' }, { status: 400 })
      }
      updates.push(`outreach_method = $${paramIdx++}`)
      values.push(body.outreachMethod)
    }
    if ('contactOutcome' in body) {
      if (!VALID_OUTCOMES.includes(body.contactOutcome as string | null)) {
        return NextResponse.json({ error: 'Invalid contact outcome' }, { status: 400 })
      }
      updates.push(`contact_outcome = $${paramIdx++}`)
      values.push(body.contactOutcome)
    }
    if ('notes' in body) {
      // Sanitize notes — strip HTML, limit length
      const notes = typeof body.notes === 'string'
        ? body.notes.replace(/<[^>]*>/g, '').slice(0, 2000)
        : null
      updates.push(`notes = $${paramIdx++}`)
      values.push(notes)
    }
    if ('isVolunteerProspect' in body) {
      updates.push(`is_volunteer_prospect = $${paramIdx++}`)
      values.push(body.isVolunteerProspect ? 1 : 0)
      if (body.isVolunteerProspect) {
        updates.push(`recruited_date = $${paramIdx++}`)
        values.push(new Date().toISOString())
      }
    }
    if ('surveyResponses' in body) {
      // Validate survey responses shape
      if (body.surveyResponses && typeof body.surveyResponses === 'object') {
        const sanitized: Record<string, string> = {}
        for (const [key, val] of Object.entries(body.surveyResponses as Record<string, unknown>)) {
          if (typeof key === 'string' && typeof val === 'string') {
            sanitized[key.slice(0, 100)] = val.slice(0, 500)
          }
        }
        updates.push(`survey_responses = $${paramIdx++}`)
        values.push(JSON.stringify(sanitized))
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(contactId)

    await db.query(`UPDATE action_items SET ${updates.join(', ')} WHERE contact_id = $${paramIdx}`, values)

    // Log meaningful actions
    if ('contactOutcome' in body) {
      await logActivity(session.userId, 'record_outcome', { contactId, outcome: body.contactOutcome })
    } else if ('contacted' in body && body.contacted) {
      await logActivity(session.userId, 'mark_contacted', { contactId, method: body.outreachMethod })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contacts/action PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
