import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockClient = {
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  release: vi.fn(),
}
const mockPool = {
  query: mockQuery,
  connect: vi.fn(async () => mockClient),
  end: vi.fn(),
}

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
vi.mock('@/lib/slugs', () => ({
  sanitizeSlug: vi.fn((input: string) => input.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')),
  validateSlug: vi.fn(() => ({ valid: true })),
}))

import { POST } from '../sign-up/route'
import { checkRateLimit } from '@/lib/rate-limit'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  phone: '555-1234',
  organizationName: 'Test Org',
  product: 'events',
}

describe('POST /api/auth/sign-up', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4 })
  })

  it('returns 400 for relational product (invite-only)', async () => {
    const res = await POST(makeRequest({ ...validBody, product: 'relational' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('invitation')
  })

  it('returns 400 for texting product (invite-only)', async () => {
    const res = await POST(makeRequest({ ...validBody, product: 'texting' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing name', async () => {
    const res = await POST(makeRequest({ ...validBody, name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'notanemail' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('email')
  })

  it('returns 400 for short password', async () => {
    const res = await POST(makeRequest({ ...validBody, password: 'short' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('8 characters')
  })

  it('returns 400 for missing organization name', async () => {
    const res = await POST(makeRequest({ ...validBody, organizationName: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing phone when product is events', async () => {
    const res = await POST(makeRequest({ ...validBody, phone: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Phone')
  })

  it('returns 409 for existing user with wrong password', async () => {
    const { hashSync } = await import('bcryptjs')
    // User exists with different password
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-1', password_hash: hashSync('differentpassword', 10) }],
      rowCount: 1,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('already exists')
  })

  it('returns 200 for new user creation', async () => {
    // No existing user
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // No existing slug
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // Post-transaction: insert verification code
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.requiresVerification).toBe(true)
    expect(json.email).toBe('test@example.com')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 300 })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
  })
})
