import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendEventReminderToHost, sendEventReminderToGuest } from '@/lib/email'

/**
 * Cron endpoint for sending event reminders.
 * Should be called every 15 minutes via a cron service.
 * Protected by CRON_SECRET Bearer token.
 *
 * Sends reminders at two windows:
 * - 24 hours before event (23.5h–24.5h window)
 * - 6 hours before event (5.5h–6.5h window)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = await getDb()
    const now = new Date()
    let totalSent = 0

    // Define reminder windows
    const windows: { type: '24h' | '6h'; minHours: number; maxHours: number }[] = [
      { type: '24h', minHours: 23.5, maxHours: 24.5 },
      { type: '6h', minHours: 5.5, maxHours: 6.5 },
    ]

    for (const window of windows) {
      const windowStart = new Date(now.getTime() + window.minHours * 60 * 60 * 1000)
      const windowEnd = new Date(now.getTime() + window.maxHours * 60 * 60 * 1000)

      // Find published events in this window
      const { rows: events } = await db.query(`
        SELECT e.id, e.title, e.start_time, e.end_time, e.timezone,
               e.location_name, e.location_address, e.location_city, e.location_state,
               e.is_virtual, e.virtual_url, e.slug, e.created_by,
               COALESCE(rc.going_count, 0) as going_count,
               COALESCE(rc.maybe_count, 0) as maybe_count
        FROM events e
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE status = 'going') as going_count,
            COUNT(*) FILTER (WHERE status = 'maybe') as maybe_count
          FROM event_rsvps WHERE event_id = e.id
        ) rc ON true
        WHERE e.status = 'published'
          AND e.start_time >= $1
          AND e.start_time <= $2
      `, [windowStart.toISOString(), windowEnd.toISOString()])

      for (const event of events) {
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

        const rsvpCounts = {
          going: parseInt(event.going_count, 10),
          maybe: parseInt(event.maybe_count, 10),
        }

        // Collect all recipient emails
        const recipients: { email: string; isHost: boolean; name?: string }[] = []

        // Host email
        const { rows: hostRows } = await db.query(
          'SELECT email, name FROM users WHERE id = $1',
          [event.created_by]
        )
        if (hostRows.length > 0 && hostRows[0].email) {
          recipients.push({ email: hostRows[0].email, isHost: true, name: hostRows[0].name })
        }

        // Authenticated RSVPs (going or maybe)
        const { rows: rsvpRows } = await db.query(`
          SELECT DISTINCT u.email, u.name
          FROM event_rsvps r
          JOIN users u ON u.id = r.user_id
          WHERE r.event_id = $1 AND r.status IN ('going', 'maybe') AND r.user_id IS NOT NULL
        `, [event.id])
        for (const row of rsvpRows) {
          if (row.email && row.email !== hostRows[0]?.email) {
            recipients.push({ email: row.email, isHost: false, name: row.name })
          }
        }

        // Guest RSVPs (no account, just email)
        const { rows: guestRows } = await db.query(`
          SELECT DISTINCT guest_email, guest_name
          FROM event_rsvps
          WHERE event_id = $1 AND status IN ('going', 'maybe') AND user_id IS NULL AND guest_email IS NOT NULL
        `, [event.id])
        for (const row of guestRows) {
          if (row.guest_email) {
            recipients.push({ email: row.guest_email, isHost: false, name: row.guest_name })
          }
        }

        // Send emails with deduplication
        for (const recipient of recipients) {
          // Try to insert into dedup log — skip if already sent
          const logId = crypto.randomUUID()
          const { rowCount } = await db.query(
            `INSERT INTO event_reminder_log (id, event_id, reminder_type, recipient_email)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (event_id, reminder_type, recipient_email) DO NOTHING`,
            [logId, event.id, window.type, recipient.email]
          )

          // rowCount === 0 means it was already sent
          if (rowCount === 0) continue

          try {
            if (recipient.isHost) {
              await sendEventReminderToHost(recipient.email, eventInfo, window.type, rsvpCounts)
            } else {
              await sendEventReminderToGuest(recipient.email, eventInfo, window.type, recipient.name)
            }
            totalSent++
          } catch (err) {
            console.error(`[cron/reminders] Failed to send ${window.type} reminder to ${recipient.email}:`, err)
            // Delete the log entry so it can be retried next run
            await db.query('DELETE FROM event_reminder_log WHERE id = $1', [logId])
          }
        }
      }
    }

    return NextResponse.json({ success: true, sent: totalSent })
  } catch (error) {
    console.error('[cron/reminders] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
