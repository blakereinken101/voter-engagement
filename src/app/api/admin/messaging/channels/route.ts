import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { genId } from '@/lib/messaging'

/** GET /api/admin/messaging/channels — list ALL channels in campaign (admin view) */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    const pool = getPool()

    const { rows } = await pool.query(
      `SELECT
        c.id, c.name, c.channel_type, c.description, c.is_archived, c.created_at,
        u.name AS created_by_name,
        (SELECT COUNT(*) FROM messaging_channel_members WHERE channel_id = c.id) AS member_count,
        (SELECT COUNT(*) FROM messaging_messages WHERE channel_id = c.id AND is_deleted = false) AS message_count,
        (SELECT MAX(m.created_at) FROM messaging_messages m WHERE m.channel_id = c.id) AS last_activity
      FROM messaging_channels c
      JOIN users u ON u.id = c.created_by
      WHERE c.campaign_id = $1
      ORDER BY c.is_archived ASC, c.created_at DESC`,
      [ctx.campaignId]
    )

    const channels = rows.map(r => ({
      id: r.id,
      name: r.name,
      channelType: r.channel_type,
      description: r.description,
      isArchived: r.is_archived,
      createdAt: r.created_at,
      createdByName: r.created_by_name,
      memberCount: parseInt(r.member_count) || 0,
      messageCount: parseInt(r.message_count) || 0,
      lastActivity: r.last_activity,
    }))

    return NextResponse.json({ channels })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** POST /api/admin/messaging/channels — admin creates a team channel with assigned members */
export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin()
    const pool = getPool()
    const body = await request.json()
    const { name, description, organizerId, memberIds } = body as {
      name: string
      description?: string
      organizerId?: string
      memberIds?: string[]
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }

    const channelId = genId()

    await pool.query(
      `INSERT INTO messaging_channels (id, campaign_id, name, channel_type, description, created_by)
       VALUES ($1, $2, $3, 'team', $4, $5)`,
      [channelId, ctx.campaignId, name.trim(), description?.trim() || null, ctx.userId]
    )

    // Add admin as channel admin
    await pool.query(
      `INSERT INTO messaging_channel_members (id, channel_id, user_id, role) VALUES ($1, $2, $3, 'admin')`,
      [genId(), channelId, ctx.userId]
    )

    // Add organizer as channel admin if specified
    if (organizerId && organizerId !== ctx.userId) {
      await pool.query(
        `INSERT INTO messaging_channel_members (id, channel_id, user_id, role) VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [genId(), channelId, organizerId]
      )
    }

    // Add volunteer members
    if (memberIds?.length) {
      for (const uid of memberIds) {
        if (uid === ctx.userId || uid === organizerId) continue
        await pool.query(
          `INSERT INTO messaging_channel_members (id, channel_id, user_id, role) VALUES ($1, $2, $3, 'member')
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [genId(), channelId, uid]
        )
      }
    }

    // System message
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
