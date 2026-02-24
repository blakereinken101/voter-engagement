import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { canManageEvent, getEventsSubscription } from '@/lib/events'
import { sendEventBlast } from '@/lib/email'
import { sendSms, formatEventBlastSms } from '@/lib/sms'

const MAX_BLASTS_PER_EVENT = 3

/**
 * GET /api/events/[eventId]/blast
 * Returns blast history + remaining count for this event.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()
    const { eventId } = params

    // Verify event exists and user can manage it
    const { rows: eventRows } = await db.query(
      'SELECT id, created_by, organization_id FROM events WHERE id = $1',
      [eventId]
    )
    if (eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const canManage = await canManageEvent(eventRows[0], session)
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get blast history
    const { rows: blasts } = await db.query(
      `SELECT id, message, channel, emails_sent, sms_sent, created_at
       FROM event_blasts WHERE event_id = $1 ORDER BY created_at DESC`,
      [eventId]
    )

    return NextResponse.json({
      blasts,
      blastsUsed: blasts.length,
      blastsRemaining: Math.max(0, MAX_BLASTS_PER_EVENT - blasts.length),
    })
  } catch (error) {
    console.error('[blast/GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/events/[eventId]/blast
 * Send a message blast to all event attendees via email and/or SMS.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()
    const { eventId } = params

    // Validate request body
    const body = await request.json()
    const { message, channel = 'both' } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (message.length > 500) {
      return NextResponse.json({ error: 'Message must be 500 characters or less' }, { status: 400 })
    }
    if (!['email', 'sms', 'both'].includes(channel)) {
      return NextResponse.json({ error: 'Channel must be email, sms, or both' }, { status: 400 })
    }

    // Load event with full details for the email template
    const { rows: eventRows } = await db.query(`
      SELECT e.*, u.name as host_name, o.logo_url as org_logo_url, o.id as org_id
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      LEFT JOIN organizations o ON o.id = e.organization_id
      WHERE e.id = $1
    `, [eventId])

    if (eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventRows[0]
    const canManage = await canManageEvent(event, session)
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check blast limit
    const { rows: blastCountRows } = await db.query(
      'SELECT COUNT(*) FROM event_blasts WHERE event_id = $1',
      [eventId]
    )
    const blastsUsed = parseInt(blastCountRows[0].count, 10)
    if (blastsUsed >= MAX_BLASTS_PER_EVENT) {
      return NextResponse.json({
        error: `You've used all ${MAX_BLASTS_PER_EVENT} blasts for this event.`,
      }, { status: 429 })
    }

    // Determine logo URL based on subscription tier
    let logoUrl: string | null = null
    if (event.org_id) {
      const subscription = await getEventsSubscription(event.org_id)
      if (subscription?.limits?.customBranding && event.org_logo_url) {
        logoUrl = event.org_logo_url
      }
    }

    const hostName = event.host_name || 'The Host'
    const eventInfo = {
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      timezone: event.timezone,
      locationName: event.location_name,
      locationAddress: event.location_address,
      locationCity: event.location_city,
      locationState: event.location_state,
      isVirtual: event.is_virtual,
      virtualUrl: event.virtual_url,
      slug: event.slug,
    }

    let emailsSent = 0
    let smsSent = 0

    // ── Collect email recipients ──────────────────────────────────
    if (channel === 'email' || channel === 'both') {
      const emailRecipients: { email: string; name?: string }[] = []
      const seenEmails = new Set<string>()

      // Host
      const { rows: hostRows } = await db.query(
        'SELECT email, name FROM users WHERE id = $1',
        [event.created_by]
      )
      if (hostRows[0]?.email) {
        seenEmails.add(hostRows[0].email.toLowerCase())
        emailRecipients.push({ email: hostRows[0].email, name: hostRows[0].name })
      }

      // Authenticated RSVPs (going or maybe)
      const { rows: rsvpRows } = await db.query(`
        SELECT DISTINCT u.email, u.name
        FROM event_rsvps r
        JOIN users u ON u.id = r.user_id
        WHERE r.event_id = $1 AND r.status IN ('going', 'maybe') AND r.user_id IS NOT NULL
      `, [eventId])
      for (const row of rsvpRows) {
        if (row.email && !seenEmails.has(row.email.toLowerCase())) {
          seenEmails.add(row.email.toLowerCase())
          emailRecipients.push({ email: row.email, name: row.name })
        }
      }

      // Guest RSVPs with email
      const { rows: guestRows } = await db.query(`
        SELECT DISTINCT guest_email, guest_name
        FROM event_rsvps
        WHERE event_id = $1 AND status IN ('going', 'maybe') AND user_id IS NULL AND guest_email IS NOT NULL
      `, [eventId])
      for (const row of guestRows) {
        if (row.guest_email && !seenEmails.has(row.guest_email.toLowerCase())) {
          seenEmails.add(row.guest_email.toLowerCase())
          emailRecipients.push({ email: row.guest_email, name: row.guest_name })
        }
      }

      // Send emails
      for (const recipient of emailRecipients) {
        try {
          await sendEventBlast(recipient.email, hostName, message.trim(), eventInfo, logoUrl)
          emailsSent++
        } catch (err) {
          console.error(`[blast] Failed to send email to ${recipient.email}:`, err)
        }
      }
    }

    // ── Collect SMS recipients ────────────────────────────────────
    if (channel === 'sms' || channel === 'both') {
      const smsRecipients: { phone: string }[] = []
      const seenPhones = new Set<string>()

      // Authenticated RSVPs with SMS opt-in
      const { rows: smsRsvpRows } = await db.query(`
        SELECT DISTINCT u.phone
        FROM event_rsvps r
        JOIN users u ON u.id = r.user_id
        WHERE r.event_id = $1
          AND r.status IN ('going', 'maybe')
          AND r.user_id IS NOT NULL
          AND u.phone IS NOT NULL
          AND u.sms_opt_in = true
      `, [eventId])
      for (const row of smsRsvpRows) {
        if (row.phone && !seenPhones.has(row.phone)) {
          seenPhones.add(row.phone)
          smsRecipients.push({ phone: row.phone })
        }
      }

      // Guest RSVPs with SMS opt-in
      const { rows: smsGuestRows } = await db.query(`
        SELECT DISTINCT guest_phone
        FROM event_rsvps
        WHERE event_id = $1
          AND status IN ('going', 'maybe')
          AND user_id IS NULL
          AND guest_phone IS NOT NULL
          AND sms_opt_in = true
      `, [eventId])
      for (const row of smsGuestRows) {
        if (row.guest_phone && !seenPhones.has(row.guest_phone)) {
          seenPhones.add(row.guest_phone)
          smsRecipients.push({ phone: row.guest_phone })
        }
      }

      // Send SMS
      const smsBody = formatEventBlastSms(hostName, event.title, message.trim(), event.slug)
      for (const recipient of smsRecipients) {
        try {
          await sendSms(recipient.phone, smsBody)
          smsSent++
        } catch (err) {
          console.error(`[blast] Failed to send SMS to ${recipient.phone}:`, err)
        }
      }
    }

    // Record the blast
    const blastId = crypto.randomUUID()
    await db.query(
      `INSERT INTO event_blasts (id, event_id, sent_by, message, channel, emails_sent, sms_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [blastId, eventId, session.userId, message.trim(), channel, emailsSent, smsSent]
    )

    return NextResponse.json({
      success: true,
      emailsSent,
      smsSent,
      blastsRemaining: Math.max(0, MAX_BLASTS_PER_EVENT - blastsUsed - 1),
    })
  } catch (error) {
    console.error('[blast/POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
