import { getDb } from '@/lib/db'
import { getSessionFromRequest, AuthError, handleAuthError } from '@/lib/auth'
import type { SessionPayload } from '@/lib/auth'

export async function requirePlatformAdmin(): Promise<SessionPayload> {
  const session = getSessionFromRequest()
  if (!session) throw new AuthError('Not authenticated', 401)

  const db = await getDb()
  const { rows } = await db.query('SELECT is_platform_admin FROM users WHERE id = $1', [session.userId])
  if (!rows[0] || !rows[0].is_platform_admin) {
    throw new AuthError('Platform admin access required', 403)
  }
  return session
}

export { handleAuthError }
