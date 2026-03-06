import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, genId } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types'

/** POST /api/messaging/dm — start or get existing DM with another user */
export async function POST(request: Request) {
  try {
    const ctx = await getMessagingContext()
    const body = await request.json()
    const { userId: targetUserId } = body as { userId: string }

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    if (targetUserId === ctx.userId) {
      return NextResponse.json({ error: 'Cannot DM yourself' }, { status: 400 })
    }

    const pool = getPool()

    // Check target user is in the same campaign
    const { rows: memberCheck } = await pool.query(
      `SELECT 1 FROM memberships WHERE user_id = $1 AND campaign_id = $2 AND is_active = true`,
      [targetUserId, ctx.campaignId]
    )
    if (memberCheck.length === 0) {
      // Also allow platform admins
      const { rows: adminCheck } = await pool.query(
        'SELECT is_platform_admin FROM users WHERE id = $1', [targetUserId]
      )
      if (!adminCheck[0]?.is_platform_admin) {
        return NextResponse.json({ error: 'User is not in this campaign' }, { status: 400 })
      }
    }

    // Volunteers can only DM people they share a channel with
    const isPrivileged = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role) || ctx.role === 'organizer'
    if (!isPrivileged) {
      const { rows: shared } = await pool.query(
        `SELECT 1 FROM messaging_channel_members a
         JOIN messaging_channel_members b ON a.channel_id = b.channel_id
         WHERE a.user_id = $1 AND b.user_id = $2
         LIMIT 1`,
        [ctx.userId, targetUserId]
      )
      if (shared.length === 0) {
        return NextResponse.json({ error: 'You can only message people on your team' }, { status: 403 })
      }
    }

    // Check if a DM already exists between these two users in this campaign
    const { rows: existing } = await pool.query(
      `SELECT c.id FROM messaging_channels c
       WHERE c.campaign_id = $1 AND c.channel_type = 'direct'
         AND EXISTS (SELECT 1 FROM messaging_channel_members WHERE channel_id = c.id AND user_id = $2)
         AND EXISTS (SELECT 1 FROM messaging_channel_members WHERE channel_id = c.id AND user_id = $3)
         AND (SELECT COUNT(*) FROM messaging_channel_members WHERE channel_id = c.id) = 2`,
      [ctx.campaignId, ctx.userId, targetUserId]
    )

    if (existing.length > 0) {
      return NextResponse.json({ channelId: existing[0].id })
    }

    // Create new DM channel
    const channelId = genId()
    await pool.query(
      `INSERT INTO messaging_channels (id, campaign_id, name, channel_type, created_by)
       VALUES ($1, $2, NULL, 'direct', $3)`,
      [channelId, ctx.campaignId, ctx.userId]
    )

    // Add both members
    await pool.query(
      `INSERT INTO messaging_channel_members (id, channel_id, user_id, role) VALUES ($1, $2, $3, 'member'), ($4, $2, $5, 'member')`,
      [genId(), channelId, ctx.userId, genId(), targetUserId]
    )

    return NextResponse.json({ channelId }, { status: 201 })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
