import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getMessagingContext } from '@/lib/messaging'
import { handleAuthError } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types'

/** GET /api/messaging/teammates — users who share a channel with you (volunteers scoped, organizer+ sees all) */
export async function GET() {
  try {
    const ctx = await getMessagingContext()
    const pool = getPool()

    const isPrivileged = ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role) || ctx.role === 'organizer'

    if (isPrivileged) {
      // Organizer+ sees all campaign members
      const { rows } = await pool.query(
        `SELECT u.id AS "userId", u.name, u.email, m.role
         FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1 AND m.is_active = true
         WHERE u.id != $2
         ORDER BY u.name ASC`,
        [ctx.campaignId, ctx.userId]
      )
      return NextResponse.json({ teammates: rows })
    }

    // Volunteers: only people who share at least one channel
    const { rows } = await pool.query(
      `SELECT DISTINCT u.id AS "userId", u.name, u.email, m.role
       FROM messaging_channel_members ocm
       JOIN users u ON u.id = ocm.user_id
       JOIN memberships m ON m.user_id = u.id AND m.campaign_id = $1 AND m.is_active = true
       WHERE ocm.channel_id IN (
         SELECT channel_id FROM messaging_channel_members WHERE user_id = $2
       )
       AND ocm.user_id != $2
       ORDER BY u.name ASC`,
      [ctx.campaignId, ctx.userId]
    )

    return NextResponse.json({ teammates: rows })
  } catch (err) {
    const { error, status } = handleAuthError(err)
    return NextResponse.json({ error }, { status })
  }
}
