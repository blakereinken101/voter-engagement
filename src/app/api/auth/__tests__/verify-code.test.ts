import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() }

vi.mock('@/lib/db', () => ({
  getPool: vi.fn(() => mockPool),
  getDb: vi.fn(async () => mockPool),
  logActivity: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4 })),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))
vi.mock('@/lib/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...original,
    getPendingSession: vi.fn(),
  }
})

import { POST } from '../verify-code/route'
import { checkRateLimit } from '@/lib/rate-limit'
import { getPendingSession } from '@/lib/auth'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/verify-code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4 })
  })

  it('returns 401 when no pending session', async () => {
    vi.mocked(getPendingSession).mockReturnValue(null)

    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toContain('pending')
  })

  it('returns 400 for invalid code format', async () => {
    vi.mocked(getPendingSession).mockReturnValue({
      userId: 'u-1', email: 'test@test.com', products: [], pending2fa: true,
    })

    const res = await POST(makeRequest({ code: 'abc' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('6-digit')
  })

  it('returns 400 when no code found in DB', async () => {
    vi.mocked(getPendingSession).mockReturnValue({
      userId: 'u-1', email: 'test@test.com', products: [], pending2fa: true,
    })

    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('No verification code')
  })

  it('returns 429 when too many attempts on stored code', async () => {
    vi.mocked(getPendingSession).mockReturnValue({
      userId: 'u-1', email: 'test@test.com', products: [], pending2fa: true,
    })

    // Find stored code with 5 attempts
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'code-1', code: '123456', expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 5 }],
      rowCount: 1,
    })
    // Mark code as used
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(429)
  })

  it('returns 400 for wrong code with remaining attempts', async () => {
    vi.mocked(getPendingSession).mockReturnValue({
      userId: 'u-1', email: 'test@test.com', products: [], pending2fa: true,
    })

    // Find stored code
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'code-1', code: '999999', expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 1 }],
      rowCount: 1,
    })
    // Increment attempts
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Incorrect')
  })

  it('returns 200 with session for correct code', async () => {
    vi.mocked(getPendingSession).mockReturnValue({
      userId: 'u-1', email: 'test@test.com', products: [], pending2fa: true,
    })

    // Find stored code
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'code-1', code: '123456', expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0 }],
      rowCount: 1,
    })
    // Increment attempts
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // Mark code used + update timestamps (Promise.all — both use same pool)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // Get user data
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-1', email: 'test@test.com', name: 'Test', is_platform_admin: false }],
      rowCount: 1,
    })
    // Get memberships
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // Get products
    mockQuery.mockResolvedValueOnce({ rows: [{ product: 'events' }], rowCount: 1 })

    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.id).toBe('u-1')
    expect(json.redirect).toBeDefined()
  })

  it('returns 429 when IP rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 300 })

    const res = await POST(makeRequest({ code: '123456' }))
    expect(res.status).toBe(429)
  })
})
