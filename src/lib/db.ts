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
  max: 10,
  idleTimeoutMillis: 30000,
})

export function getPool(): Pool {
  return pool
}

// Schema is now managed by node-pg-migrate (runs before server boots).
// getDb() is kept for backward compatibility with existing call sites.
export async function getDb(): Promise<Pool> {
  return pool
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>, campaignId?: string) {
  await pool.query(
    `INSERT INTO activity_log (user_id, action, details, campaign_id) VALUES ($1, $2, $3, $4)`,
    [userId, action, details ? JSON.stringify(details) : null, campaignId || null]
  )
}
