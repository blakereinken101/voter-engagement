import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, genId } from '@/lib/messaging'
import { handleAuthError, AuthError } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types'

/** GET /api/messaging/channels — list channels for the current user + campaign */
export async function GET() {
  try {
    const ctx = await getMessagingContext()
    const pool = getPool()

    const { rows } = await pool.query(
      `SELECT
        c.id, c.campaign_id, c.name, c.channel_type, c.description,
        c.created_by, c.is_archived, c.created_at, c.updated_at,
        cm.last_read_at,
        cm.muted,
        (SELECT COUNT(*) FROM messaging_channel_members WHERE channel_id = c.id) AS member_count,
        (SELECT COUNT(*) FROM messaging_messages m
          WHERE m.channel_id = c.id AND m.created_at > cm.last_read_at
            AND m.is_deleted = false) AS unread_count,
        (SELECT row_to_json(sub) FROM (
          SELECT m.id, m.content, m.sender_id, m.created_at, u.name AS sender_name
          FROM messaging_messages m
          JOIN users u ON u.id = m.sender_id
          WHERE m.channel_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) sub) AS last_message,
        -- For DMs, get the other member's name
        CASE WHEN c.channel_type = 'direct' THEN (
          SELECT u.name FROM messaging_channel_members ocm
          JOIN users u ON u.id = ocm.user_id
          WHERE ocm.channel_id = c.id AND ocm.user_id != $1
          LIMIT 1
        ) ELSE NULL END AS dm_partner_name
      FROM messaging_channels c
      JOIN messaging_channel_members cm ON cm.channel_id = c.id AND cm.user_id = $1
      WHERE c.campaign_id = $2 AND c.is_archived = false
      ORDER BY
        (SELECT MAX(m.created_at) FROM messaging_messages m WHERE m.channel_id = c.id) DESC NULLS LAST,
        c.created_at DESC`,
      [ctx.userId, ctx.campaignId]
    )

    const channels = rows.map(r => ({
      id: r.id,
      campaignId: r.campaign_id,
      name: r.channel_type === 'direct' ? r.dm_partner_name : r.name,
      channelType: r.channel_type,
      description: r.description,
      createdBy: r.created_by,
      isArchived: r.is_archived,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      unreadCount: parseInt(r.unread_count) || 0,
      memberCount: parseInt(r.member_count) || 0,
      muted: r.muted,
      lastMessage: r.last_message ? {
        id: r.last_message.id,
        content: r.last_message.content,
        senderId: r.last_message.sender_id,
        senderName: r.last_message.sender_name,
        createdAt: r.last_message.created_at,
      } : null,
    }))

    return NextResponse.json({ channels })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** POST /api/messaging/channels — create a team channel (organizer+) */
export async function POST(request: Request) {
  try {
    const ctx = await getMessagingContext()

    // Only organizer+ can create team channels
    if (!ctx.isPlatformAdmin && !ADMIN_ROLES.includes(ctx.role) && ctx.role !== 'organizer') {
      throw new AuthError('Only organizers and admins can create channels', 403)
    }

    const body = await request.json()
    const { name, description, memberIds } = body as {
      name: string
      description?: string
      memberIds?: string[]
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }

    const pool = getPool()
    const channelId = genId()

    await pool.query(
      `INSERT INTO messaging_channels (id, campaign_id, name, channel_type, description, created_by)
       VALUES ($1, $2, $3, 'team', $4, $5)`,
      [channelId, ctx.campaignId, name.trim(), description?.trim() || null, ctx.userId]
    )

    // Add creator as channel admin
    await pool.query(
      `INSERT INTO messaging_channel_members (id, channel_id, user_id, role)
       VALUES ($1, $2, $3, 'admin')`,
      [genId(), channelId, ctx.userId]
    )

    // Add other members
    if (memberIds?.length) {
      const values = memberIds
        .filter(id => id !== ctx.userId)
        .map(id => `('${genId()}', '${channelId}', '${id}', 'member')`)
      if (values.length > 0) {
        await pool.query(
          `INSERT INTO messaging_channel_members (id, channel_id, user_id, role)
           VALUES ${values.join(', ')}
           ON CONFLICT (channel_id, user_id) DO NOTHING`
        )
      }
    }

    // Add a system message
    await pool.query(
      `INSERT INTO messaging_messages (id, channel_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'system')`,
      [genId(), channelId, ctx.userId, `created the channel "${name.trim()}"`]
    )

    return NextResponse.json({ channelId }, { status: 201 })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
