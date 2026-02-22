import { getRequestContext, requireCampaignAdmin, AuthError, handleAuthError, type RequestContext } from '@/lib/auth'

/**
 * Legacy-compatible admin guard. Returns the request context or throws.
 * Replaces the old requireAdmin() — now checks campaign membership role.
 */
export async function requireAdmin(): Promise<RequestContext> {
  const ctx = await getRequestContext()
  requireCampaignAdmin(ctx)
  return ctx
}

export { AuthError, handleAuthError, type RequestContext }
