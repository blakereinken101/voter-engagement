import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest, handleAuthError } from '@/lib/auth'
import { canViewEvent, getEventsSubscription, checkRsvpLimit, mapRsvpRow } from '@/lib/events'
import { fireAndForget, syncSignupToVan, findVanCampaignForOrg } from '@/lib/van-sync'

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const session = getSessionFromRequest()
    const db = await getDb()

    // Get event for visibility check
    const { rows: eventRows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!await canViewEvent(eventRows[0], session)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const { rows } = await db.query(`
      SELECT er.*, u.name as user_name
      FROM event_rsvps er
      LEFT JOIN users u ON u.id = er.user_id
      WHERE er.event_id = $1
      ORDER BY er.created_at ASC
    `, [eventId])

    const rsvps = rows.map(mapRsvpRow)

    const counts = {
      going: rows.filter(r => r.status === 'going').length,
      maybe: rows.filter(r => r.status === 'maybe').length,
      notGoing: rows.filter(r => r.status === 'not_going').length,
    }

    return NextResponse.json({ rsvps, counts })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const session = getSessionFromRequest()
    const db = await getDb()

    // Get event
    const { rows: eventRows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventRows[0]

    if (!event.rsvp_enabled) {
      return NextResponse.json({ error: 'RSVPs are not enabled for this event' }, { status: 400 })
    }

    if (!await canViewEvent(event, session)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status: rsvpStatus, guestCount, note, guestName, guestEmail, phone, guestPhone, smsOptIn } = body

    if (!rsvpStatus || !['going', 'maybe', 'not_going'].includes(rsvpStatus)) {
      return NextResponse.json({ error: 'Invalid RSVP status' }, { status: 400 })
    }

    // Check max attendees
    if (event.max_attendees && rsvpStatus === 'going') {
      const { rows: countRows } = await db.query(
        "SELECT COALESCE(SUM(guest_count), 0) as total FROM event_rsvps WHERE event_id = $1 AND status = 'going'",
        [eventId]
      )
      const currentTotal = parseInt(countRows[0].total, 10)
      if (currentTotal + (guestCount || 1) > event.max_attendees) {
        return NextResponse.json({ error: 'Event is at capacity' }, { status: 409 })
      }
    }

    // Check RSVP limits for the org's plan
    if (rsvpStatus === 'going') {
      const sub = await getEventsSubscription(event.organization_id)
      if (sub) {
        await checkRsvpLimit(event.organization_id, sub)
      }
    }

    if (session) {
      // Authenticated RSVP — upsert
      const id = crypto.randomUUID()
      await db.query(`
        INSERT INTO event_rsvps (id, event_id, user_id, status, guest_count, note, sms_opt_in)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (event_id, user_id) DO UPDATE SET
          status = EXCLUDED.status,
          guest_count = EXCLUDED.guest_count,
          note = EXCLUDED.note,
          sms_opt_in = EXCLUDED.sms_opt_in,
          updated_at = NOW()
      `, [id, eventId, session.userId, rsvpStatus, guestCount || 1, note || null, !!smsOptIn])

      // Only update user SMS settings when phone field was explicitly included
      if (phone !== undefined) {
        if (phone.trim() && smsOptIn) {
          await db.query(
            'UPDATE users SET phone = $1, sms_opt_in = true WHERE id = $2',
            [phone.trim(), session.userId]
          )
        } else if (smsOptIn === false) {
          await db.query('UPDATE users SET sms_opt_in = false WHERE id = $1', [session.userId])
        }
      }

      await logActivity(session.userId, 'event_rsvp', { eventId, status: rsvpStatus })

      if (rsvpStatus === 'going' || rsvpStatus === 'maybe') {
        fireAndForget(async () => {
          const vanCampaignId = await findVanCampaignForOrg(event.organization_id)
          if (vanCampaignId) await syncSignupToVan(vanCampaignId, eventId, id)
        }, `signup:${id}`)
      }

      return NextResponse.json({ id, success: true })
    } else {
      // Guest RSVP — only for public events
      if (event.visibility !== 'public') {
        return NextResponse.json({ error: 'Sign in to RSVP to this event' }, { status: 401 })
      }

      if (!guestName?.trim()) {
        return NextResponse.json({ error: 'Name is required for guest RSVP' }, { status: 400 })
      }

      const id = crypto.randomUUID()
      await db.query(`
        INSERT INTO event_rsvps (id, event_id, guest_name, guest_email, status, guest_count, note, guest_phone, sms_opt_in)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [id, eventId, guestName.trim(), guestEmail?.trim() || null, rsvpStatus, guestCount || 1, note || null, guestPhone?.trim() || null, !!smsOptIn])

      return NextResponse.json({ id, success: true })
    }
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
