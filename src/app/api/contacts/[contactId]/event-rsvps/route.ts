import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRequestContext, AuthError, handleAuthError } from '@/lib/auth'
import crypto from 'crypto'

export async function GET(request: NextRequest, { params }: { params: { contactId: string } }) {
  try {
    const ctx = await getRequestContext()
    const { contactId } = params
    if (!contactId || typeof contactId !== 'string' || contactId.length > 100) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 })
    }

    const db = await getDb()

    // Verify ownership
    const { rows: contactRows } = await db.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3',
      [contactId, ctx.userId, ctx.campaignId],
    )
    if (!contactRows[0]) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const { rows } = await db.query(`
      SELECT cer.id, cer.contact_id, cer.event_id, cer.status, cer.notes,
             cer.created_at, cer.updated_at,
             e.title as event_title, e.start_time as event_start_time
      FROM contact_event_rsvps cer
      JOIN events e ON e.id = cer.event_id
      WHERE cer.contact_id = $1
      ORDER BY e.start_time ASC
    `, [contactId])

    return NextResponse.json({
      rsvps: rows.map(r => ({
        id: r.id,
        contactId: r.contact_id,
        eventId: r.event_id,
        status: r.status,
        notes: r.notes || null,
        eventTitle: r.event_title,
        eventStartTime: r.event_start_time,
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[contacts/event-rsvps GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { contactId: string } }) {
  try {
    const ctx = await getRequestContext()
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

    const { eventId, status, notes } = body as { eventId?: string; status?: string; notes?: string }

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }
    if (!status || !['yes', 'no', 'maybe'].includes(status)) {
      return NextResponse.json({ error: 'status must be yes, no, or maybe' }, { status: 400 })
    }

    const db = await getDb()

    // Verify contact ownership
    const { rows: contactRows } = await db.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND campaign_id = $3',
      [contactId, ctx.userId, ctx.campaignId],
    )
    if (!contactRows[0]) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // Verify event belongs to same org as the contact's campaign
    const { rows: eventRows } = await db.query(`
      SELECT e.id FROM events e
      JOIN campaigns c ON c.org_id = e.organization_id
      WHERE e.id = $1 AND c.id = $2
    `, [eventId, ctx.campaignId])
    if (!eventRows[0]) return NextResponse.json({ error: 'Event not found for this campaign' }, { status: 404 })

    const sanitizedNotes = typeof notes === 'string' ? notes.replace(/<[^>]*>/g, '').slice(0, 500) : null
    const id = crypto.randomUUID()

    await db.query(`
      INSERT INTO contact_event_rsvps (id, contact_id, event_id, status, notes, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (contact_id, event_id) DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `, [id, contactId, eventId, status, sanitizedNotes, ctx.userId])

    return NextResponse.json({ success: true, id })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[contacts/event-rsvps PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
