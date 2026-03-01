import { Pool } from 'pg'

// Railway internal connections (*.railway.internal) don't use SSL.
// Only enable SSL for external connections.
const dbUrl = process.env.DATABASE_URL || ''
const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true }
  : false

const pool = new Pool({
  connectionString: dbUrl || undefined,
  ssl: useSSL,
  max: 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // fail fast if pool is exhausted
})

export function getPool(): Pool {
  return pool
}

// ── Graceful shutdown ──────────────────────────────────────────────
// When Railway sends SIGTERM during a rolling deploy, give in-flight
// requests up to 15 seconds to finish, then close the pool cleanly.
let shuttingDown = false

export function isShuttingDown(): boolean {
  return shuttingDown
}

function gracefulShutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] Received ${signal} — draining connections...`)

  // Stop accepting new work, let in-flight finish (pool.end waits for idle)
  setTimeout(async () => {
    try {
      await pool.end()
      console.log('[shutdown] Database pool closed.')
    } catch (err) {
      console.error('[shutdown] Error closing pool:', err)
    }
    process.exit(0)
  }, 15_000) // 15s grace period for in-flight requests
}

// Only register signal handlers at runtime — not during `next build`
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

// Schema is now managed by node-pg-migrate (runs before server boots).
// getDb() is kept for backward compatibility with existing call sites.
export async function getDb(): Promise<Pool> {
  return pool
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>, campaignId?: string) {
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id, action, details, campaign_id) VALUES ($1, $2, $3, $4)`,
      [userId, action, details ? JSON.stringify(details) : null, campaignId || null]
    )
  } catch (err) {
    // Activity logging should never crash a request
    console.error('[logActivity] Failed (non-fatal):', err)
  }
}
