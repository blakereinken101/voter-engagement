/**
 * Messaging helpers — auth context for messaging routes and channel utilities.
 */
import { getSessionFromRequest, getActiveCampaignId, AuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { MembershipRole, ADMIN_ROLES } from '@/types'
import crypto from 'crypto'

export interface MessagingContext {
  userId: string
  email: string
  campaignId: string
  role: MembershipRole
  isPlatformAdmin: boolean
}

/**
 * Like getRequestContext() but checks for 'messaging' product instead of 'relational'.
 */
export async function getMessagingContext(): Promise<MessagingContext> {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const campaignId = getActiveCampaignId()
  if (!campaignId) throw new AuthError('No campaign selected', 400)

  const pool = getPool()

  const { rows: userRows } = await pool.query(
    'SELECT is_platform_admin FROM users WHERE id = $1',
    [session.userId]
  )
  if (userRows.length === 0) throw new AuthError('User not found', 401)
  const isPlatformAdmin = !!userRows[0].is_platform_admin

  // Check messaging product access
  if (!isPlatformAdmin) {
    const { rows: productRows } = await pool.query(
      `SELECT 1 FROM user_products WHERE user_id = $1 AND product = 'messaging' AND is_active = true`,
      [session.userId]
    )
    if (productRows.length === 0) {
      throw new AuthError('No access to messaging', 403)
    }
  }

  // Get membership role
  const { rows: memberRows } = await pool.query(
    'SELECT role FROM memberships WHERE user_id = $1 AND campaign_id = $2 AND is_active = true',
    [session.userId, campaignId]
  )

  if (memberRows.length === 0 && !isPlatformAdmin) {
    throw new AuthError('Not a member of this campaign', 403)
  }

  const role: MembershipRole = memberRows.length > 0
    ? memberRows[0].role as MembershipRole
    : 'platform_admin'

  return {
    userId: session.userId,
    email: session.email,
    campaignId,
    role: isPlatformAdmin ? 'platform_admin' : role,
    isPlatformAdmin,
  }
}

export function genId(): string {
  return crypto.randomUUID()
}

/**
 * Verify the user is a member of the given channel. Returns their channel role.
 */
export async function requireChannelMember(userId: string, channelId: string): Promise<'admin' | 'member'> {
  const pool = getPool()
  const { rows } = await pool.query(
    'SELECT role FROM messaging_channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId]
  )
  if (rows.length === 0) {
    throw new AuthError('Not a member of this channel', 403)
  }
  return rows[0].role
}

/**
 * Verify the user can admin the channel (channel admin or campaign admin+).
 */
export async function requireChannelAdmin(ctx: MessagingContext, channelId: string): Promise<void> {
  if (ctx.isPlatformAdmin || ADMIN_ROLES.includes(ctx.role)) return
  const channelRole = await requireChannelMember(ctx.userId, channelId)
  if (channelRole !== 'admin') {
    throw new AuthError('Insufficient channel permissions', 403)
  }
}
