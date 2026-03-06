import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext } from '@/lib/messaging'
import { handleAuthError, AuthError } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types'

/** PUT /api/messaging/messages/[messageId] — edit a message */
export async function PUT(request: Request, { params }: { params: { messageId: string } }) {
  try {
    const ctx = await getMessagingContext()
    const body = await request.json()
    const { content } = body as { content: string }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    const pool = getPool()

    // Only the sender can edit their own message
    const { rows } = await pool.query(
      'SELECT sender_id FROM messaging_messages WHERE id = $1',
      [params.messageId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (rows[0].sender_id !== ctx.userId) {
      throw new AuthError('Can only edit your own messages', 403)
    }

    await pool.query(
      `UPDATE messaging_messages SET content = $1, is_edited = true, updated_at = NOW()
       WHERE id = $2`,
      [content.trim(), params.messageId]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** DELETE /api/messaging/messages/[messageId] — soft-delete a message */
export async function DELETE(_request: Request, { params }: { params: { messageId: string } }) {
  try {
    const ctx = await getMessagingContext()
    const pool = getPool()

    const { rows } = await pool.query(
      'SELECT sender_id FROM messaging_messages WHERE id = $1',
      [params.messageId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Sender or campaign admin can delete
    if (rows[0].sender_id !== ctx.userId && !ctx.isPlatformAdmin && !ADMIN_ROLES.includes(ctx.role)) {
      throw new AuthError('Insufficient permissions', 403)
    }

    await pool.query(
      `UPDATE messaging_messages SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [params.messageId]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
