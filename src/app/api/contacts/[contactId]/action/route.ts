import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { contactId: string } }) {
  try {
    const session = getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { contactId } = params
    const body = await request.json()

    const db = getDb()

    // Verify ownership
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?').get(contactId, session.userId)
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // Build dynamic update
    const updates: string[] = []
    const values: unknown[] = []

    if ('contacted' in body) {
      updates.push('contacted = ?')
      values.push(body.contacted ? 1 : 0)
      if (body.contacted) {
        updates.push('contacted_date = ?')
        values.push(new Date().toISOString())
      }
    }
    if ('outreachMethod' in body) {
      updates.push('outreach_method = ?')
      values.push(body.outreachMethod)
    }
    if ('contactOutcome' in body) {
      updates.push('contact_outcome = ?')
      values.push(body.contactOutcome)
    }
    if ('notes' in body) {
      updates.push('notes = ?')
      values.push(body.notes)
    }
    if ('isVolunteerProspect' in body) {
      updates.push('is_volunteer_prospect = ?')
      values.push(body.isVolunteerProspect ? 1 : 0)
      if (body.isVolunteerProspect) {
        updates.push('recruited_date = ?')
        values.push(new Date().toISOString())
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = datetime(\'now\')')
    values.push(contactId)

    db.prepare(`UPDATE action_items SET ${updates.join(', ')} WHERE contact_id = ?`).run(...values)

    // Log meaningful actions
    if ('contactOutcome' in body) {
      logActivity(db, session.userId, 'record_outcome', { contactId, outcome: body.contactOutcome })
    } else if ('contacted' in body && body.contacted) {
      logActivity(db, session.userId, 'mark_contacted', { contactId, method: body.outreachMethod })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contacts/action PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
