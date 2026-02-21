import { Pool } from 'pg'
import { hashSync } from 'bcryptjs'

// Railway internal connections (*.railway.internal) don't use SSL.
// Only enable SSL for external connections.
const dbUrl = process.env.DATABASE_URL || ''
const useSSL = dbUrl.includes('.railway.internal') ? false
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false }
  : false

const pool = new Pool({
  connectionString: dbUrl || undefined,
  ssl: useSSL,
  max: 10,
  idleTimeoutMillis: 30000,
})

let _initialized = false

export function getPool(): Pool {
  return pool
}

export async function getDb(): Promise<Pool> {
  if (!_initialized) {
    await initSchema()
    _initialized = true
  }
  return pool
}

async function initSchema() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'volunteer',
        campaign_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        city TEXT,
        zip TEXT,
        age INTEGER,
        age_range TEXT,
        gender TEXT,
        category TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS match_results (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        best_match_data TEXT,
        candidates_data TEXT,
        vote_score REAL,
        segment TEXT,
        user_confirmed INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS action_items (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
        contacted INTEGER NOT NULL DEFAULT 0,
        contacted_date TEXT,
        outreach_method TEXT,
        contact_outcome TEXT,
        follow_up_date TEXT,
        notes TEXT,
        is_volunteer_prospect INTEGER DEFAULT 0,
        recruited_date TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_match_results_contact_id ON match_results(contact_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_contact_id ON action_items(contact_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
    `)

    // Seed admin user if no users exist
    const userCount = await client.query('SELECT COUNT(*) as count FROM users')
    if (parseInt(userCount.rows[0].count) === 0) {
      const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@votecircle.local'
      const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'changeme123'
      const id = crypto.randomUUID()
      const passwordHash = hashSync(adminPassword, 10)

      await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, campaign_id)
         VALUES ($1, $2, $3, $4, 'admin', $5)`,
        [id, adminEmail, passwordHash, 'Admin', process.env.CAMPAIGN_ID || 'demo-2026']
      )

      console.log(`[db] Seeded admin user: ${adminEmail}`)
    }
  } finally {
    client.release()
  }
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>) {
  await pool.query(
    `INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)`,
    [userId, action, details ? JSON.stringify(details) : null]
  )
}
