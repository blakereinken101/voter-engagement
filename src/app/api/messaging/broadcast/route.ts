import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, genId } from '@/lib/messaging'
import { handleAuthError, AuthError } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types'
import { notifyNewMessage } from '@/lib/messaging-realtime'

/** POST /api/messaging/broadcast — send a message to the campaign broadcast channel */
export async function POST(request: Request) {
  try {
    const ctx = await getMessagingContext()

    // Only campaign admins+ can broadcast
    if (!ctx.isPlatformAdmin && !ADMIN_ROLES.includes(ctx.role)) {
      throw new AuthError('Only campaign admins can broadcast', 403)
    }

    const body = await request.json()
    const { content } = body as { content: string }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    const pool = getPool()

    // Find or create the broadcast channel for this campaign
    let { rows } = await pool.query(
      `SELECT id FROM messaging_channels
       WHERE campaign_id = $1 AND channel_type = 'broadcast' AND is_archived = false
       LIMIT 1`,
      [ctx.campaignId]
    )

    let broadcastChannelId: string

    if (rows.length === 0) {
      // Create broadcast channel and add all campaign members
      broadcastChannelId = genId()
      await pool.query(
        `INSERT INTO messaging_channels (id, campaign_id, name, channel_type, description, created_by)
         VALUES ($1, $2, 'Announcements', 'broadcast', 'Campaign-wide announcements', $3)`,
        [broadcastChannelId, ctx.campaignId, ctx.userId]
      )

      // Add all active campaign members
      const { rows: members } = await pool.query(
        'SELECT user_id FROM memberships WHERE campaign_id = $1 AND is_active = true',
        [ctx.campaignId]
      )
      for (const m of members) {
        await pool.query(
          `INSERT INTO messaging_channel_members (id, channel_id, user_id, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [genId(), broadcastChannelId, m.user_id,
            m.user_id === ctx.userId ? 'admin' : 'member']
        )
      }
    } else {
      broadcastChannelId = rows[0].id

      // Ensure all current campaign members are in the broadcast channel
      await pool.query(
        `INSERT INTO messaging_channel_members (id, channel_id, user_id, role)
         SELECT gen_random_uuid()::text, $1, m.user_id, 'member'
         FROM memberships m
         WHERE m.campaign_id = $2 AND m.is_active = true
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [broadcastChannelId, ctx.campaignId]
      )
    }

    // Send the announcement
    const messageId = genId()
    const { rows: msgRows } = await pool.query(
      `INSERT INTO messaging_messages (id, channel_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'announcement')
       RETURNING id, channel_id, sender_id, content, message_type, created_at, updated_at`,
      [messageId, broadcastChannelId, ctx.userId, content.trim()]
    )

    const { rows: userRows } = await pool.query('SELECT name FROM users WHERE id = $1', [ctx.userId])

    const msg = msgRows[0]
    const message = {
      id: msg.id,
      channelId: msg.channel_id,
      senderId: msg.sender_id,
      content: msg.content,
      messageType: msg.message_type,
      parentId: null,
      isEdited: false,
      isDeleted: false,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
      senderName: userRows[0]?.name || 'Admin',
    }

    notifyNewMessage(broadcastChannelId, message)

    return NextResponse.json({ message, broadcastChannelId }, { status: 201 })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
