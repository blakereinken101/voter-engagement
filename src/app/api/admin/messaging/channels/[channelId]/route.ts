import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'

/** GET /api/admin/messaging/channels/[channelId] — channel details + members (admin view) */
export async function GET(_request: Request, { params }: { params: { channelId: string } }) {
  try {
    await requireAdmin()
    const pool = getPool()

    const { rows: channelRows } = await pool.query(
      `SELECT c.*, u.name AS created_by_name FROM messaging_channels c
       JOIN users u ON u.id = c.created_by
       WHERE c.id = $1`,
      [params.channelId]
    )
    if (channelRows.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const { rows: members } = await pool.query(
      `SELECT cm.id, cm.user_id, cm.role, cm.joined_at, u.name, u.email, m.role AS campaign_role
       FROM messaging_channel_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $2 AND m.is_active = true
       WHERE cm.channel_id = $1
       ORDER BY cm.role DESC, u.name ASC`,
      [params.channelId, channelRows[0].campaign_id]
    )

    const ch = channelRows[0]
    return NextResponse.json({
      channel: {
        id: ch.id,
        name: ch.name,
        channelType: ch.channel_type,
        description: ch.description,
        isArchived: ch.is_archived,
        createdAt: ch.created_at,
        createdByName: ch.created_by_name,
      },
      members: members.map(m => ({
        id: m.id,
        userId: m.user_id,
        name: m.name,
        email: m.email,
        channelRole: m.role,
        campaignRole: m.campaign_role,
        joinedAt: m.joined_at,
      })),
    })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** PUT /api/admin/messaging/channels/[channelId] — archive/unarchive or rename */
export async function PUT(request: Request, { params }: { params: { channelId: string } }) {
  try {
    await requireAdmin()
    const pool = getPool()
    const body = await request.json()
    const { name, description, isArchived } = body as {
      name?: string
      description?: string
      isArchived?: boolean
    }

    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name.trim()) }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description.trim() || null) }
    if (isArchived !== undefined) { sets.push(`is_archived = $${idx++}`); vals.push(isArchived) }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    sets.push(`updated_at = NOW()`)
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
