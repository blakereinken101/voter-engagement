import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, requireChannelMember, genId } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'
import { notifyNewMessage } from '@/lib/messaging-realtime'

/** GET /api/messaging/channels/[channelId]/messages — paginated messages */
export async function GET(request: NextRequest, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    await requireChannelMember(ctx.userId, params.channelId)

    const searchParams = request.nextUrl.searchParams
    const cursor = searchParams.get('cursor') // ISO timestamp
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const pool = getPool()
    const vals: unknown[] = [params.channelId, limit]
    let whereClause = 'WHERE m.channel_id = $1'

    if (cursor) {
      whereClause += ' AND m.created_at < $3'
      vals.push(cursor)
    }

    const { rows } = await pool.query(
      `SELECT m.id, m.channel_id, m.sender_id, m.content, m.message_type,
              m.parent_id, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
              u.name AS sender_name
       FROM messaging_messages m
       JOIN users u ON u.id = m.sender_id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      vals
    )

    const messages = rows.reverse().map(r => ({
      id: r.id,
      channelId: r.channel_id,
      senderId: r.sender_id,
      content: r.is_deleted ? '' : r.content,
      messageType: r.message_type,
      parentId: r.parent_id,
      isEdited: r.is_edited,
      isDeleted: r.is_deleted,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      senderName: r.sender_name,
    }))

    const hasMore = rows.length === limit

    return NextResponse.json({ messages, hasMore })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** POST /api/messaging/channels/[channelId]/messages — send a message */
export async function POST(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    await requireChannelMember(ctx.userId, params.channelId)

    const body = await request.json()
    const { content, parentId } = body as { content: string; parentId?: string }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    if (content.length > 4000) {
      return NextResponse.json({ error: 'Message too long (max 4000 characters)' }, { status: 400 })
    }

    const pool = getPool()
    const messageId = genId()

    const { rows } = await pool.query(
      `INSERT INTO messaging_messages (id, channel_id, sender_id, content, parent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, channel_id, sender_id, content, message_type, parent_id, is_edited, is_deleted, created_at, updated_at`,
      [messageId, params.channelId, ctx.userId, content.trim(), parentId || null]
    )

    // Get sender name
    const { rows: userRows } = await pool.query('SELECT name FROM users WHERE id = $1', [ctx.userId])

    const msg = rows[0]
    const message = {
      id: msg.id,
      channelId: msg.channel_id,
      senderId: msg.sender_id,
      content: msg.content,
      messageType: msg.message_type,
      parentId: msg.parent_id,
      isEdited: msg.is_edited,
      isDeleted: msg.is_deleted,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
      senderName: userRows[0]?.name || 'Unknown',
    }

    // Notify connected SSE clients
    notifyNewMessage(params.channelId, message)

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
