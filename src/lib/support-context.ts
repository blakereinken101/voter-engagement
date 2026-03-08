/**
 * Auth context for support routes.
 * Unlike getRequestContext() which requires 'relational' product access,
 * support is available to all authenticated campaign members.
 */
import { getSessionFromRequest, getActiveCampaignId, AuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { MembershipRole, ADMIN_ROLES } from '@/types'

export interface SupportContext {
  userId: string
  email: string
  campaignId: string
  role: MembershipRole
  isPlatformAdmin: boolean
  userName: string
}

/**
 * Get auth context for support routes. Any campaign member can access support.
 */
export async function getSupportContext(): Promise<SupportContext> {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const campaignId = getActiveCampaignId()
  if (!campaignId) throw new AuthError('No campaign selected', 400)

  const pool = getPool()

  const { rows: userRows } = await pool.query(
    'SELECT is_platform_admin, name FROM users WHERE id = $1',
    [session.userId]
  )
  if (userRows.length === 0) throw new AuthError('User not found', 401)
  const isPlatformAdmin = !!userRows[0].is_platform_admin
  const userName = userRows[0].name as string

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
    userName,
  }
}

/**
 * Require admin-level access for support management operations.
 */
export function requireSupportAdmin(ctx: SupportContext): void {
  if (ctx.isPlatformAdmin) return
  if (!ADMIN_ROLES.includes(ctx.role)) {
    throw new AuthError('Insufficient permissions', 403)
  }
}
