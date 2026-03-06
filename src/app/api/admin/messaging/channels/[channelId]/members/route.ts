import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/admin-guard'
import { genId } from '@/lib/messaging'

/** POST /api/admin/messaging/channels/[channelId]/members — admin adds members */
export async function POST(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await requireAdmin()
    const pool = getPool()
    const body = await request.json()
    const { userIds, role } = body as { userIds: string[]; role?: 'admin' | 'member' }

    if (!userIds?.length) {
      return NextResponse.json({ error: 'userIds required' }, { status: 400 })
    }

    // Verify users are campaign members
    const { rows: validUsers } = await pool.query(
      `SELECT user_id FROM memberships
       WHERE campaign_id = $1 AND is_active = true AND user_id = ANY($2)`,
      [ctx.campaignId, userIds]
    )
    const validIds = new Set(validUsers.map(r => r.user_id))

    let added = 0
    for (const uid of userIds) {
      if (!validIds.has(uid)) continue
      await pool.query(
        `INSERT INTO messaging_channel_members (id, channel_id, user_id, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [genId(), params.channelId, uid, role || 'member']
      )
      added++
    }

    return NextResponse.json({ added })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** DELETE /api/admin/messaging/channels/[channelId]/members — admin removes a member */
export async function DELETE(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await requireAdmin()
    const pool = getPool()
    const body = await request.json()
    const { userId } = body as { userId: string }

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    await pool.query(
      'DELETE FROM messaging_channel_members WHERE channel_id = $1 AND user_id = $2',
      [params.channelId, userId]
    )

    // Get user name for system message
    const { rows: userRows } = await pool.query('SELECT name FROM users WHERE id = $1', [userId])
    const userName = userRows[0]?.name || 'Someone'

    await pool.query(
      `INSERT INTO messaging_messages (id, channel_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'system')`,
      [genId(), params.channelId, ctx.userId, `removed ${userName} from the channel`]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
