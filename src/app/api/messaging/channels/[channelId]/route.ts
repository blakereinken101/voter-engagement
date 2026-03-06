import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, requireChannelMember, requireChannelAdmin } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'

/** GET /api/messaging/channels/[channelId] — channel details + members */
export async function GET(_request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    await requireChannelMember(ctx.userId, params.channelId)

    const pool = getPool()

    const { rows: channelRows } = await pool.query(
      `SELECT id, campaign_id, name, channel_type, description, created_by, is_archived, created_at, updated_at
       FROM messaging_channels WHERE id = $1`,
      [params.channelId]
    )
    if (channelRows.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const { rows: memberRows } = await pool.query(
      `SELECT cm.id, cm.channel_id, cm.user_id, cm.role, cm.last_read_at, cm.muted, cm.joined_at,
              u.name AS user_name, u.email AS user_email
       FROM messaging_channel_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.channel_id = $1
       ORDER BY cm.role DESC, u.name ASC`,
      [params.channelId]
    )

    const c = channelRows[0]
    return NextResponse.json({
      channel: {
        id: c.id,
        campaignId: c.campaign_id,
        name: c.name,
        channelType: c.channel_type,
        description: c.description,
        createdBy: c.created_by,
        isArchived: c.is_archived,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        members: memberRows.map(m => ({
          id: m.id,
          channelId: m.channel_id,
          userId: m.user_id,
          role: m.role,
          lastReadAt: m.last_read_at,
          muted: m.muted,
          joinedAt: m.joined_at,
          userName: m.user_name,
          userEmail: m.user_email,
        })),
      },
    })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** PUT /api/messaging/channels/[channelId] — update channel name/description/archive */
export async function PUT(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    await requireChannelAdmin(ctx, params.channelId)

    const body = await request.json()
    const { name, description, isArchived } = body as {
      name?: string
      description?: string
      isArchived?: boolean
    }

    const pool = getPool()
    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name.trim()) }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description.trim()) }
    if (isArchived !== undefined) { sets.push(`is_archived = $${idx++}`); vals.push(isArchived) }
    sets.push(`updated_at = NOW()`)

    if (sets.length <= 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    vals.push(params.channelId)
    await pool.query(
      `UPDATE messaging_channels SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
