import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db')
vi.mock('@/lib/cache', () => ({
  createCache: () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}))

import {
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createSessionToken,
  verifySessionToken,
  createPendingToken,
  createResetPendingToken,
  setSessionCookie,
  clearSessionCookie,
  requireRole,
  requireCampaignAdmin,
  handleAuthError,
  AuthError,
} from '../auth'
import type { RequestContext, SessionPayload } from '../auth'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it', () => {
    const hash = hashPassword('mypassword')
    expect(hash).toMatch(/^\$2[ab]\$/)
    expect(verifyPassword('mypassword', hash)).toBe(true)
  })

  it('rejects wrong password', () => {
    const hash = hashPassword('correct')
    expect(verifyPassword('wrong', hash)).toBe(false)
  })

  it('produces different hashes each time (random salt)', () => {
    const h1 = hashPassword('same')
    const h2 = hashPassword('same')
    expect(h1).not.toBe(h2)
  })
})

describe('generateVerificationCode', () => {
  it('returns a 6-digit string', () => {
    const code = generateVerificationCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('returns value between 100000 and 999999', () => {
    for (let i = 0; i < 20; i++) {
      const num = parseInt(generateVerificationCode(), 10)
      expect(num).toBeGreaterThanOrEqual(100000)
      expect(num).toBeLessThanOrEqual(999999)
    }
  })

  it('generates varying codes', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateVerificationCode()))
    expect(codes.size).toBeGreaterThanOrEqual(2)
  })
})

describe('createSessionToken / verifySessionToken', () => {
  const payload: SessionPayload = {
    userId: 'u-123',
    email: 'test@example.com',
    products: ['relational'],
  }

  it('creates a valid JWT', () => {
    const token = createSessionToken(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('verifies and returns the payload', () => {
    const token = createSessionToken(payload)
    const result = verifySessionToken(token)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('u-123')
    expect(result!.email).toBe('test@example.com')
    expect(result!.products).toEqual(['relational'])
  })

  it('returns null for garbage token', () => {
    expect(verifySessionToken('not.a.jwt')).toBeNull()
  })

  it('returns null for expired token', () => {
    const expired = jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' })
    expect(verifySessionToken(expired)).toBeNull()
  })

  it('defaults products to empty array for old tokens', () => {
    const oldPayload = { userId: 'u-old', email: 'old@test.com' }
    const token = jwt.sign(oldPayload, JWT_SECRET, { expiresIn: '1h' })
    const result = verifySessionToken(token)
    expect(result).not.toBeNull()
    expect(result!.products).toEqual([])
  })
})

describe('createPendingToken', () => {
  it('creates a JWT with pending2fa flag', () => {
    const token = createPendingToken('u-1', 'test@test.com')
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
    expect(decoded.userId).toBe('u-1')
    expect(decoded.email).toBe('test@test.com')
    expect(decoded.pending2fa).toBe(true)
  })

  it('includes product and plan when provided', () => {
    const token = createPendingToken('u-1', 'test@test.com', { product: 'events', plan: 'starter' })
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
    expect(decoded.product).toBe('events')
    expect(decoded.plan).toBe('starter')
  })
})

describe('createResetPendingToken', () => {
  it('creates a JWT with pendingReset flag', () => {
    const token = createResetPendingToken('u-1', 'test@test.com')
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
    expect(decoded.userId).toBe('u-1')
    expect(decoded.pendingReset).toBe(true)
  })
})

describe('setSessionCookie / clearSessionCookie', () => {
  it('returns Set-Cookie header with token', () => {
    const headers = setSessionCookie('my-token')
    const cookie = headers['Set-Cookie'] as string
    expect(cookie).toContain('vc-session=my-token')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('clears session cookie with Max-Age=0', () => {
    const headers = clearSessionCookie()
    const cookie = headers['Set-Cookie'] as string
    expect(cookie).toContain('vc-session=')
    expect(cookie).toContain('Max-Age=0')
  })
})

describe('requireRole', () => {
  function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
    return {
      userId: 'u-1',
      email: 'test@test.com',
      campaignId: 'c-1',
      role: 'volunteer',
      isPlatformAdmin: false,
      ...overrides,
    }
  }

  it('platform admin always passes', () => {
    const ctx = makeCtx({ isPlatformAdmin: true, role: 'volunteer' })
    expect(() => requireRole(ctx, 'campaign_admin')).not.toThrow()
  })

  it('matching role passes', () => {
    const ctx = makeCtx({ role: 'campaign_admin' })
    expect(() => requireRole(ctx, 'campaign_admin', 'org_owner')).not.toThrow()
  })

  it('non-matching role throws AuthError 403', () => {
    const ctx = makeCtx({ role: 'volunteer' })
    expect(() => requireRole(ctx, 'campaign_admin')).toThrow(AuthError)
    try {
      requireRole(ctx, 'campaign_admin')
    } catch (e) {
      expect((e as AuthError).statusCode).toBe(403)
    }
  })
})

describe('requireCampaignAdmin', () => {
  function makeCtx(role: string, isPlatformAdmin = false): RequestContext {
    return { userId: 'u', email: 'e', campaignId: 'c', role: role as any, isPlatformAdmin }
  }

  it('allows org_owner', () => {
    expect(() => requireCampaignAdmin(makeCtx('org_owner'))).not.toThrow()
  })

  it('allows campaign_admin', () => {
    expect(() => requireCampaignAdmin(makeCtx('campaign_admin'))).not.toThrow()
  })

  it('allows platform_admin via isPlatformAdmin flag', () => {
    expect(() => requireCampaignAdmin(makeCtx('volunteer', true))).not.toThrow()
  })

  it('rejects volunteer', () => {
    expect(() => requireCampaignAdmin(makeCtx('volunteer'))).toThrow(AuthError)
  })

  it('rejects organizer', () => {
    expect(() => requireCampaignAdmin(makeCtx('organizer'))).toThrow(AuthError)
  })
})

describe('AuthError', () => {
  it('has correct message and statusCode', () => {
    const err = new AuthError('Forbidden', 403)
    expect(err.message).toBe('Forbidden')
    expect(err.statusCode).toBe(403)
    expect(err instanceof Error).toBe(true)
  })

  it('defaults to 401', () => {
    const err = new AuthError('Unauthorized')
    expect(err.statusCode).toBe(401)
  })
})

describe('handleAuthError', () => {
  it('handles AuthError', () => {
    const result = handleAuthError(new AuthError('Forbidden', 403))
    expect(result).toEqual({ error: 'Forbidden', status: 403 })
  })

  it('handles unknown errors as 500', () => {
    const result = handleAuthError(new Error('oops'))
    expect(result).toEqual({ error: 'Internal server error', status: 500 })
  })
})
