import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Rate-limit has a module-level setInterval, so we need fake timers before import
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// Dynamic import to reset module state between describe blocks
async function importRateLimit() {
  const mod = await import('../rate-limit')
  return mod
}

describe('checkRateLimit', () => {
  it('allows first request', async () => {
    const { checkRateLimit } = await importRateLimit()
    const result = checkRateLimit('test-first-' + Date.now())
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('decrements remaining on each request', async () => {
    const { checkRateLimit } = await importRateLimit()
    const key = 'test-decrement-' + Date.now()
    checkRateLimit(key)
    const r2 = checkRateLimit(key)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(3)
  })

  it('blocks after exceeding max attempts', async () => {
    const { checkRateLimit } = await importRateLimit()
    const key = 'test-block-' + Date.now()
    const config = { maxAttempts: 3, windowMs: 60000, blockDurationMs: 60000 }

    checkRateLimit(key, config) // 1
    checkRateLimit(key, config) // 2
    checkRateLimit(key, config) // 3
    const blocked = checkRateLimit(key, config) // 4 → over limit

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after window expires', async () => {
    const { checkRateLimit } = await importRateLimit()
    const key = 'test-reset-' + Date.now()
    const config = { maxAttempts: 2, windowMs: 1000, blockDurationMs: 1000 }

    checkRateLimit(key, config)
    checkRateLimit(key, config)

    // Window expires
    vi.advanceTimersByTime(1100)

    const result = checkRateLimit(key, config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('keeps different keys independent', async () => {
    const { checkRateLimit } = await importRateLimit()
    const config = { maxAttempts: 1, windowMs: 60000, blockDurationMs: 60000 }
    const ts = Date.now()

    checkRateLimit('key-a-' + ts, config)
    checkRateLimit('key-a-' + ts, config) // blocked

    const resultB = checkRateLimit('key-b-' + ts, config)
    expect(resultB.allowed).toBe(true)
  })

  it('stays blocked until block duration expires', async () => {
    const { checkRateLimit } = await importRateLimit()
    const key = 'test-stay-blocked-' + Date.now()
    // Window must also expire for the counter to reset after unblock
    const config = { maxAttempts: 1, windowMs: 5000, blockDurationMs: 5000 }

    checkRateLimit(key, config)
    checkRateLimit(key, config) // triggers block

    vi.advanceTimersByTime(3000) // still blocked
    expect(checkRateLimit(key, config).allowed).toBe(false)

    vi.advanceTimersByTime(3000) // block + window expired
    expect(checkRateLimit(key, config).allowed).toBe(true)
  })
})

describe('getClientIP', () => {
  it('extracts IP from x-forwarded-for header', async () => {
    const { getClientIP } = await importRateLimit()
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIP(request)).toBe('1.2.3.4')
  })

  it('returns unknown when no forwarded header', async () => {
    const { getClientIP } = await importRateLimit()
    const request = new Request('http://localhost')
    expect(getClientIP(request)).toBe('unknown')
  })
})
