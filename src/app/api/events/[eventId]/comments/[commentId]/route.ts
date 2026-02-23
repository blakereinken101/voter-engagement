import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSessionFromRequest, handleAuthError, AuthError } from '@/lib/auth'
import { canManageEvent } from '@/lib/events'

export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string; commentId: string } }
) {
  try {
    const { commentId } = params
    const session = getSessionFromRequest()
    if (!session) throw new AuthError('Not authenticated', 401)

    const db = await getDb()

    const { rows } = await db.query(
      'SELECT * FROM event_comments WHERE id = $1',
      [commentId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Only comment author can edit
    if (rows[0].user_id !== session.userId) {
      throw new AuthError('Only the comment author can edit', 403)
    }

    const body = await request.json()
    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    await db.query(
      'UPDATE event_comments SET content = $1, updated_at = NOW() WHERE id = $2',
      [body.content.trim(), commentId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string; commentId: string } }
) {
  try {
    const { eventId, commentId } = params
    const session = getSessionFromRequest()
    if (!session) throw new AuthError('Not authenticated', 401)

    const db = await getDb()

    const { rows: commentRows } = await db.query(
      'SELECT * FROM event_comments WHERE id = $1',
      [commentId]
    )
    if (commentRows.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Author can delete, or event manager can delete
    if (commentRows[0].user_id !== session.userId) {
      const { rows: eventRows } = await db.query('SELECT * FROM events WHERE id = $1', [eventId])
      if (eventRows.length === 0 || !await canManageEvent(eventRows[0], session)) {
        throw new AuthError('Not authorized to delete this comment', 403)
      }
    }

    await db.query('DELETE FROM event_comments WHERE id = $1', [commentId])

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
