import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, handleAuthError, AuthError } from '@/lib/auth'
import { canViewEvent } from '@/lib/events'

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
      SELECT emoji, COUNT(*) as count,
             BOOL_OR(user_id = $2) as user_reacted
      FROM event_reactions
      WHERE event_id = $1
      GROUP BY emoji
      ORDER BY count DESC
    `, [eventId, session?.userId || ''])

    const reactions = rows.map(row => ({
      emoji: row.emoji,
      count: parseInt(row.count, 10),
      userReacted: !!row.user_reacted,
    }))

    return NextResponse.json({ reactions })
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
    if (!session) throw new AuthError('Sign in to react', 401)

    const db = await getDb()

    // Verify event exists
    const { rows: eventRows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (eventRows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!await canViewEvent(eventRows[0], session)) {
      throw new AuthError('Not authorized', 403)
    }

    const body = await request.json()
    const { emoji } = body

    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 })
    }

    // Toggle: if exists, remove. If not, add.
    const { rows: existing } = await db.query(
      'SELECT id FROM event_reactions WHERE event_id = $1 AND user_id = $2 AND emoji = $3',
      [eventId, session.userId, emoji]
    )

    if (existing.length > 0) {
      await db.query('DELETE FROM event_reactions WHERE id = $1', [existing[0].id])
      return NextResponse.json({ added: false, success: true })
    } else {
      const id = crypto.randomUUID()
      await db.query(
        'INSERT INTO event_reactions (id, event_id, user_id, emoji) VALUES ($1, $2, $3, $4)',
        [id, eventId, session.userId, emoji]
      )
      return NextResponse.json({ added: true, success: true })
    }
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
