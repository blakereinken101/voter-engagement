import { getSessionFromRequest } from '@/lib/auth'

export function requireAdmin() {
  const session = getSessionFromRequest()
  if (!session) throw new Error('Not authenticated')
  if (session.role !== 'admin') throw new Error('Admin access required')
  return session
}
