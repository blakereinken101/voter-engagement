import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext, requireChannelMember } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'

/** PUT /api/messaging/channels/[channelId]/read — mark channel as read */
export async function PUT(_request: Request, { params }: { params: { channelId: string } }) {
  try {
    const ctx = await getMessagingContext()
    await requireChannelMember(ctx.userId, params.channelId)

    const pool = getPool()
    await pool.query(
      `UPDATE messaging_channel_members SET last_read_at = NOW()
       WHERE channel_id = $1 AND user_id = $2`,
      [params.channelId, ctx.userId]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
