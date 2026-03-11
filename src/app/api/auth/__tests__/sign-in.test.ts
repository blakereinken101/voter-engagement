import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() }

vi.mock('@/lib/db', () => ({
  getPool: vi.fn(() => mockPool),
  getDb: vi.fn(async () => mockPool),
  logActivity: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendVerificationCode: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4 })),
  getClientIP: vi.fn(() => '127.0.0.1'),
}))

import { POST } from '../sign-in/route'
import { hashSync } from 'bcryptjs'
import { checkRateLimit } from '@/lib/rate-limit'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4 })
  })

  it('returns 400 for missing email', async () => {
    const res = await POST(makeRequest({ password: 'test' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('required')
  })

  it('returns 400 for missing password', async () => {
    const res = await POST(makeRequest({ email: 'test@test.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 for invalid credentials', async () => {
    // User not found
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await POST(makeRequest({ email: 'nobody@test.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toContain('Invalid')
  })

  it('returns 200 with verification required for valid credentials', async () => {
    const passwordHash = hashSync('correct-password', 10)

    // User lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-1', email: 'test@test.com', password_hash: passwordHash, name: 'Test', is_platform_admin: false }],
      rowCount: 1,
    })
    // Product lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ product: 'relational' }], rowCount: 1 })
    // Invalidate old codes
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // Insert new code
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

    const res = await POST(makeRequest({ email: 'test@test.com', password: 'correct-password' }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.requiresVerification).toBe(true)
    expect(json.email).toBe('test@test.com')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 300 })

    const res = await POST(makeRequest({ email: 'test@test.com', password: 'any' }))
    expect(res.status).toBe(429)
  })
})
