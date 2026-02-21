/**
 * In-memory rate limiter.
 * Tracks attempts per key (typically IP address) with a sliding window.
 * Automatically cleans up expired entries to prevent memory leaks.
 */

interface RateLimitEntry {
  attempts: number
  firstAttempt: number
  blockedUntil?: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    const windowExpired = now - entry.firstAttempt > 15 * 60 * 1000
    const blockExpired = !entry.blockedUntil || now > entry.blockedUntil
    if (windowExpired && blockExpired) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitConfig {
  maxAttempts: number    // Max attempts before blocking
  windowMs: number       // Time window in milliseconds
  blockDurationMs: number // How long to block after exceeding limit
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,       // 15 minutes
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}

/**
 * Check if a request is allowed under the rate limit.
 * Call this BEFORE processing the request.
 *
 * @param key - Unique identifier (e.g., IP address or `action:ip`)
 * @param config - Rate limit configuration (optional, defaults to 5 per 15 min)
 */
export function checkRateLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIG): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // No previous attempts
  if (!entry) {
    store.set(key, { attempts: 1, firstAttempt: now })
    return { allowed: true, remaining: config.maxAttempts - 1 }
  }

  // Currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  // Window expired — reset
  if (now - entry.firstAttempt > config.windowMs) {
    store.set(key, { attempts: 1, firstAttempt: now })
    return { allowed: true, remaining: config.maxAttempts - 1 }
  }

  // Within window — increment
  entry.attempts++

  if (entry.attempts > config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs
    const retryAfterSeconds = Math.ceil(config.blockDurationMs / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: config.maxAttempts - entry.attempts }
}

/**
 * Extract client IP from a Next.js request.
 * Checks x-forwarded-for (set by Railway/proxies) first, then falls back.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can be comma-separated; first is the real client
    return forwarded.split(',')[0].trim()
  }
  return 'unknown'
}
