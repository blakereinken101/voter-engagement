import { NextRequest, NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest, handleAuthError } from '@/lib/auth'
import { getEventsContext, generateSlug, mapEventRow, canViewEvent } from '@/lib/events'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status') || 'published'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const orgId = searchParams.get('orgId')

    const session = getSessionFromRequest()
    const db = await getDb()

    // Build query with filters
    const conditions: string[] = ['e.status = $1']
    const params: (string | number)[] = [status]
    let paramIdx = 2

    if (type) {
      conditions.push(`e.event_type = $${paramIdx}`)
      params.push(type)
      paramIdx++
    }

    if (from) {
      conditions.push(`e.start_time >= $${paramIdx}`)
      params.push(from)
      paramIdx++
    }

    if (to) {
      conditions.push(`e.start_time <= $${paramIdx}`)
      params.push(to)
      paramIdx++
    }

    if (orgId) {
      conditions.push(`e.organization_id = $${paramIdx}`)
      params.push(orgId)
      paramIdx++
    }

    // Visibility scoping: unauthenticated users only see public events
    if (!session) {
      conditions.push(`e.visibility = 'public'`)
    }

    const whereClause = conditions.join(' AND ')

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
      WHERE ${whereClause}
      ORDER BY e.start_time ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset])

    // For authenticated users, filter out org-only events they don't have access to
    let events = rows.map(mapEventRow)
    if (session) {
      const filtered = []
      for (const event of events) {
        const rawEvent = rows.find(r => r.id === event.id)
        if (rawEvent && await canViewEvent(rawEvent, session)) {
          filtered.push(event)
        }
      }
      events = filtered
    }

    // Get total count
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM events e WHERE ${whereClause}`,
      params
    )
    const total = parseInt(countRows[0].count, 10)

    return NextResponse.json({ events, total })
  } catch (error) {
    console.error('[events GET]', error)
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getEventsContext()
    const db = await getDb()
    const body = await request.json()

    const {
      title, description, eventType, startTime, endTime, timezone,
      locationName, locationAddress, locationCity, locationState, locationZip,
      isVirtual, virtualUrl, coverImageUrl, emoji, themeColor,
      visibility, maxAttendees, rsvpEnabled, status,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!startTime) {
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 })
    }
    if (!eventType) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const slug = generateSlug(title)

    await db.query(`
      INSERT INTO events (
        id, organization_id, created_by, title, description, event_type,
        start_time, end_time, timezone,
        location_name, location_address, location_city, location_state, location_zip,
        is_virtual, virtual_url,
        cover_image_url, emoji, theme_color,
        visibility, max_attendees, rsvp_enabled, status, slug
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23, $24
      )
    `, [
      id, ctx.organizationId, ctx.userId, title.trim(), description || null, eventType,
      startTime, endTime || null, timezone || 'America/New_York',
      locationName || null, locationAddress || null, locationCity || null, locationState || null, locationZip || null,
      isVirtual || false, virtualUrl || null,
      coverImageUrl || null, emoji || '🗳️', themeColor || '#6C3CE1',
      visibility || 'public', maxAttendees ? parseInt(maxAttendees, 10) : null, rsvpEnabled !== false, status || 'published', slug,
    ])

    await logActivity(ctx.userId, 'event_created', { eventId: id, title, eventType })

    return NextResponse.json({ id, slug, success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
