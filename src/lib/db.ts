import Database from 'better-sqlite3'
import path from 'path'
import { hashSync } from 'bcryptjs'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'votecircle.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'volunteer',
      campaign_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_match_results_contact_id ON match_results(contact_id);
    CREATE INDEX IF NOT EXISTS idx_action_items_contact_id ON action_items(contact_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
  `)

  // Seed admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (userCount.count === 0) {
    const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@votecircle.local'
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'changeme123'
    const id = crypto.randomUUID()
    const passwordHash = hashSync(adminPassword, 10)

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, campaign_id)
      VALUES (?, ?, ?, ?, 'admin', 'demo-2026')
    `).run(id, adminEmail, passwordHash, 'Admin')

    console.log(`[db] Seeded admin user: ${adminEmail}`)
  }
}

export function logActivity(db: Database.Database, userId: string, action: string, details?: Record<string, unknown>) {
  db.prepare(`
    INSERT INTO activity_log (user_id, action, details)
    VALUES (?, ?, ?)
  `).run(userId, action, details ? JSON.stringify(details) : null)
}
