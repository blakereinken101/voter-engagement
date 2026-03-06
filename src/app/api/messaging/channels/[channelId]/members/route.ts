import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, requireChannelAdmin, genId } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'

/** POST /api/messaging/channels/[channelId]/members — add members */
export async function POST(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    await requireChannelAdmin(ctx, params.channelId)

    const body = await request.json()
    const { userIds } = body as { userIds: string[] }

    if (!userIds?.length) {
      return NextResponse.json({ error: 'userIds required' }, { status: 400 })
    }

    const pool = getPool()

    // Verify all users are members of the same campaign
    const { rows: validUsers } = await pool.query(
      `SELECT user_id FROM memberships
       WHERE campaign_id = $1 AND is_active = true AND user_id = ANY($2)`,
      [ctx.campaignId, userIds]
    )
    const validIds = new Set(validUsers.map(r => r.user_id))

    let added = 0
    for (const uid of userIds) {
      if (!validIds.has(uid)) continue
      try {
        await pool.query(
          `INSERT INTO messaging_channel_members (id, channel_id, user_id, role)
           VALUES ($1, $2, $3, 'member')
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [genId(), params.channelId, uid]
        )
        added++
      } catch { /* duplicate — skip */ }
    }

    return NextResponse.json({ added })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}

/** DELETE /api/messaging/channels/[channelId]/members — remove a member */
export async function DELETE(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    const body = await request.json()
    const { userId } = body as { userId: string }

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Users can remove themselves, or channel/campaign admins can remove others
    if (userId !== ctx.userId) {
      await requireChannelAdmin(ctx, params.channelId)
    }

    const pool = getPool()
    await pool.query(
      'DELETE FROM messaging_channel_members WHERE channel_id = $1 AND user_id = $2',
      [params.channelId, userId]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
