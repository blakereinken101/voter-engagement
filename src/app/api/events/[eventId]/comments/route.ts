import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, handleAuthError, AuthError } from '@/lib/auth'
import { canViewEvent, mapCommentRow } from '@/lib/events'

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
      SELECT ec.*, u.name as user_name
      FROM event_comments ec
      LEFT JOIN users u ON u.id = ec.user_id
      WHERE ec.event_id = $1
      ORDER BY ec.created_at ASC
    `, [eventId])

    // Build threaded structure
    const comments = rows.map(r => ({ ...mapCommentRow(r), replies: [] as ReturnType<typeof mapCommentRow>[] }))
    const topLevel = comments.filter(c => !c.parentId)
    const childComments = comments.filter(c => c.parentId)

    for (const comment of topLevel) {
      comment.replies = childComments.filter(r => r.parentId === comment.id)
    }

    return NextResponse.json({ comments: topLevel })
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
    if (!session) throw new AuthError('Sign in to comment', 401)

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
    const { content, parentId } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    // If replying, verify parent exists and belongs to same event
    if (parentId) {
      const { rows: parentRows } = await db.query(
        'SELECT id FROM event_comments WHERE id = $1 AND event_id = $2',
        [parentId, eventId]
      )
      if (parentRows.length === 0) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
      }
    }

    const id = crypto.randomUUID()
    await db.query(`
      INSERT INTO event_comments (id, event_id, user_id, parent_id, content)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, eventId, session.userId, parentId || null, content.trim()])

    // Fetch the created comment with user name
    const { rows } = await db.query(`
      SELECT ec.*, u.name as user_name
      FROM event_comments ec
      LEFT JOIN users u ON u.id = ec.user_id
      WHERE ec.id = $1
    `, [id])

    return NextResponse.json({ comment: mapCommentRow(rows[0]), success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
