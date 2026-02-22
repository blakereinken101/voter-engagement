import { hashSync, compareSync } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { MembershipRole, ADMIN_ROLES } from '@/types'
import { getPool } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export interface SessionPayload {
  userId: string
  email: string
}

export interface RequestContext {
  userId: string
  email: string
  campaignId: string
  role: MembershipRole
  isPlatformAdmin: boolean
}

export function hashPassword(password: string): string {
  return hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash)
}

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload
    return decoded
  } catch {
    return null
  }
}

export function getSessionFromRequest(): SessionPayload | null {
  const cookieStore = cookies()
  const token = cookieStore.get('vc-session')?.value
  if (!token) return null
  return verifySessionToken(token)
}

export function getActiveCampaignId(): string | null {
  const cookieStore = cookies()
  return cookieStore.get('vc-campaign')?.value || null
}

export function setSessionCookie(token: string): HeadersInit {
  return {
    'Set-Cookie': `vc-session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
  }
}

export function clearSessionCookie(): HeadersInit {
  return {
    'Set-Cookie': `vc-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  }
}

// ── 2FA Pending Session ──────────────────────────────────────────

export function createPendingToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, pending2fa: true }, JWT_SECRET, { expiresIn: '10m' })
}

export function getPendingSession(): SessionPayload | null {
  const cookieStore = cookies()
  const token = cookieStore.get('vc-2fa-pending')?.value
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload & { pending2fa?: boolean }
    if (!decoded.pending2fa) return null
    return decoded
  } catch {
    return null
  }
}

// ── Password Reset Pending Session ───────────────────────────────

export function createResetPendingToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, pendingReset: true }, JWT_SECRET, { expiresIn: '10m' })
}

export function getResetPendingSession(): SessionPayload | null {
  const cookieStore = cookies()
  const token = cookieStore.get('vc-reset-pending')?.value
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload & { pendingReset?: boolean }
    if (!decoded.pendingReset) return null
    return decoded
  } catch {
    return null
  }
}

export function generateVerificationCode(): string {
  // Generate a random 6-digit code (100000-999999)
  const array = new Uint32Array(1)
  globalThis.crypto.getRandomValues(array)
  return String(100000 + (array[0] % 900000))
}

/**
 * Get full request context including campaign membership.
 * Use this instead of getSessionFromRequest() for campaign-scoped endpoints.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  // Get active campaign from cookie
  const campaignId = getActiveCampaignId()
  if (!campaignId) throw new AuthError('No campaign selected', 400)

  const pool = getPool()

  // Look up user's platform admin status
  const { rows: userRows } = await pool.query(
    'SELECT is_platform_admin FROM users WHERE id = $1',
    [session.userId]
  )
  if (userRows.length === 0) throw new AuthError('User not found', 401)
  const isPlatformAdmin = !!userRows[0].is_platform_admin

  // Look up membership for active campaign
  const { rows: memberRows } = await pool.query(
    'SELECT role FROM memberships WHERE user_id = $1 AND campaign_id = $2 AND is_active = true',
    [session.userId, campaignId]
  )

  // Platform admins can access any campaign even without membership
  if (memberRows.length === 0 && !isPlatformAdmin) {
    throw new AuthError('Not a member of this campaign', 403)
  }

  const role: MembershipRole = memberRows.length > 0
    ? memberRows[0].role as MembershipRole
    : 'platform_admin' // platform admin accessing campaign without explicit membership

  return {
    userId: session.userId,
    email: session.email,
    campaignId,
    role: isPlatformAdmin ? 'platform_admin' : role,
    isPlatformAdmin,
  }
}

/**
 * Require one of the specified roles. Throws AuthError if not authorized.
 */
export function requireRole(ctx: RequestContext, ...roles: MembershipRole[]): void {
  // Platform admins always pass
  if (ctx.isPlatformAdmin) return
  if (!roles.includes(ctx.role)) {
    throw new AuthError('Insufficient permissions', 403)
  }
}

/**
 * Check if the user has admin-level access to the campaign.
 */
export function requireCampaignAdmin(ctx: RequestContext): void {
  requireRole(ctx, ...ADMIN_ROLES)
}

export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number = 401) {
    super(message)
    this.statusCode = statusCode
  }
}

/**
 * Standard error response handler for auth errors.
 */
export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return { error: error.message, status: error.statusCode }
  }
  return { error: 'Internal server error', status: 500 }
}
