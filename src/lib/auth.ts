import { hashSync, compareSync } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export interface SessionPayload {
  userId: string
  email: string
  role: 'volunteer' | 'admin'
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
