import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest, handleAuthError, AuthError } from '@/lib/auth'
import { canViewEvent, canManageEvent, mapEventRow } from '@/lib/events'

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const session = getSessionFromRequest()
    const db = await getDb()

    // Support lookup by either ID or slug
    const isUUID = eventId.includes('-') && eventId.length > 10
    const lookupField = isUUID ? 'e.id' : 'e.slug'

    const { rows } = await db.query(`
      SELECT e.*,
             u.name as creator_name,
             o.name as org_name,
             COALESCE(rc.going_count, 0) as going_count,
             COALESCE(rc.maybe_count, 0) as maybe_count,
             COALESCE(rc.not_going_count, 0) as not_going_count
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      LEFT JOIN organizations o ON o.id = e.organization_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'going') as going_count,
          COUNT(*) FILTER (WHERE status = 'maybe') as maybe_count,
          COUNT(*) FILTER (WHERE status = 'not_going') as not_going_count
        FROM event_rsvps WHERE event_id = e.id
      ) rc ON true
      WHERE ${lookupField} = $1
    `, [eventId])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const row = rows[0]

    // Check visibility
    if (!await canViewEvent(row, session)) {
      return NextResponse.json({ error: 'Sign in to view this event' }, { status: 401 })
    }

    const event = mapEventRow(row)

    // If user is authenticated, include their RSVP status
    let userRsvp = null
    if (session) {
      const { rows: rsvpRows } = await db.query(
        'SELECT id, status, guest_count, note FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
        [row.id, session.userId]
      )
      if (rsvpRows.length > 0) {
        userRsvp = {
          id: rsvpRows[0].id,
          status: rsvpRows[0].status,
          guestCount: rsvpRows[0].guest_count,
          note: rsvpRows[0].note,
        }
      }
    }

    // Check if user can manage this event
    const canManage = session ? await canManageEvent(row, session) : false

    return NextResponse.json({ event, userRsvp, canManage })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const session = getSessionFromRequest()
    if (!session) throw new AuthError('Not authenticated', 401)

    const db = await getDb()

    // Get event
    const { rows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!await canManageEvent(rows[0], session)) {
      throw new AuthError('Not authorized to edit this event', 403)
    }

    const body = await request.json()
    const updatableFields: Record<string, string> = {
      title: 'title',
      description: 'description',
      eventType: 'event_type',
      startTime: 'start_time',
      endTime: 'end_time',
      timezone: 'timezone',
      locationName: 'location_name',
      locationAddress: 'location_address',
      locationCity: 'location_city',
      locationState: 'location_state',
      locationZip: 'location_zip',
      isVirtual: 'is_virtual',
      virtualUrl: 'virtual_url',
      coverImageUrl: 'cover_image_url',
      emoji: 'emoji',
      themeColor: 'theme_color',
      visibility: 'visibility',
      maxAttendees: 'max_attendees',
      rsvpEnabled: 'rsvp_enabled',
      status: 'status',
    }

    const setClauses: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let idx = 1

    for (const [clientKey, dbKey] of Object.entries(updatableFields)) {
      if (body[clientKey] !== undefined) {
        setClauses.push(`${dbKey} = $${idx}`)
        values.push(body[clientKey])
        idx++
      }
    }

    if (values.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(eventId)
    await db.query(
      `UPDATE events SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      values
    )

    await logActivity(session.userId, 'event_updated', { eventId, fields: Object.keys(body) })

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const session = getSessionFromRequest()
    if (!session) throw new AuthError('Not authenticated', 401)

    const db = await getDb()

    const { rows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!await canManageEvent(rows[0], session)) {
      throw new AuthError('Not authorized to delete this event', 403)
    }

    await db.query('DELETE FROM events WHERE id = $1', [eventId])
    await logActivity(session.userId, 'event_deleted', { eventId, title: rows[0].title })

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
