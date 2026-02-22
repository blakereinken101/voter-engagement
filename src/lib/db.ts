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
    // ── Users table (keep legacy role + campaign_id for backward compat) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'volunteer',
        campaign_id TEXT NOT NULL DEFAULT 'demo-2026',
        is_platform_admin BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Add is_platform_admin if upgrading from old schema
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;
    `)

    // ── Organizations ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Campaigns ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        candidate_name TEXT,
        state TEXT NOT NULL DEFAULT 'NC',
        election_date DATE,
        settings JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(org_id, slug)
      );
    `)

    // ── Memberships ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'volunteer',
        invited_by TEXT REFERENCES users(id),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        UNIQUE(user_id, campaign_id)
      );
    `)

    // ── Invitations ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'volunteer',
        token TEXT UNIQUE NOT NULL,
        invited_by TEXT NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        max_uses INTEGER DEFAULT 1,
        use_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Contacts + match_results + action_items + activity_log ────────
    await client.query(`
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

      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS survey_responses TEXT;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS campaign_id TEXT REFERENCES campaigns(id);
      ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS campaign_id TEXT;
    `)

    // ── Indexes ──────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_match_results_contact_id ON match_results(contact_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_contact_id ON action_items(contact_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_campaign_id ON memberships(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
      CREATE INDEX IF NOT EXISTS idx_invitations_campaign_id ON invitations(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_campaign_id ON activity_log(campaign_id);
    `)

    // ── Seed defaults ────────────────────────────────────────────────
    await seedDefaults(client)
  } finally {
    client.release()
  }
}

async function seedDefaults(client: import('pg').PoolClient) {
  const campaignId = process.env.CAMPAIGN_ID || 'demo-2026'
  const orgId = 'org-default'
  const orgName = process.env.NEXT_PUBLIC_ORGANIZATION_NAME || 'Threshold'
  const campaignName = process.env.NEXT_PUBLIC_CAMPAIGN_NAME || 'Threshold Demo'
  const candidateName = process.env.NEXT_PUBLIC_CANDIDATE_NAME || 'Demo Candidate'
  const state = process.env.NEXT_PUBLIC_CAMPAIGN_STATE || 'NC'
  const electionDate = process.env.ELECTION_DATE || '2026-11-03'

  // Ensure default organization exists
  const { rows: existingOrg } = await client.query('SELECT id FROM organizations WHERE id = $1', [orgId])
  if (existingOrg.length === 0) {
    await client.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
      [orgId, orgName, 'default']
    )
    console.log(`[db] Seeded default organization: ${orgName}`)
  }

  // Ensure default campaign exists
  const { rows: existingCampaign } = await client.query('SELECT id FROM campaigns WHERE id = $1', [campaignId])
  if (existingCampaign.length === 0) {
    await client.query(
      `INSERT INTO campaigns (id, org_id, name, slug, candidate_name, state, election_date, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [campaignId, orgId, campaignName, campaignId, candidateName, state, electionDate, JSON.stringify({
        surveyQuestions: [
          { id: 'top_issue', label: 'Top issue', type: 'select', options: ['Economy', 'Healthcare', 'Education', 'Environment', 'Immigration', 'Housing', 'Crime/Safety', 'Other'] },
          { id: 'vote_plan', label: 'Plan to vote?', type: 'select', options: ['Yes - Election Day', 'Yes - Early voting', 'Yes - By mail', 'Maybe', 'No'] },
          { id: 'needs_ride', label: 'Needs ride to polls?', type: 'select', options: ['Yes', 'No', 'Maybe'] },
        ],
      })]
    )
    console.log(`[db] Seeded default campaign: ${campaignName}`)
  }

  // Ensure admin user exists
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@thresholdvote.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'changeme123'
  const { rows: existingAdmin } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])

  let adminId: string
  if (existingAdmin.length === 0) {
    adminId = crypto.randomUUID()
    const passwordHash = hashSync(adminPassword, 10)
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, campaign_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, 'admin', $5, true)`,
      [adminId, adminEmail, passwordHash, 'Admin', campaignId]
    )
    console.log(`[db] Seeded admin user: ${adminEmail}`)
  } else {
    adminId = existingAdmin[0].id as string
    await client.query('UPDATE users SET is_platform_admin = true WHERE id = $1', [adminId])
  }

  // Ensure admin has membership in default campaign
  const { rows: existingMembership } = await client.query(
    'SELECT id FROM memberships WHERE user_id = $1 AND campaign_id = $2',
    [adminId, campaignId]
  )
  if (existingMembership.length === 0) {
    await client.query(
      `INSERT INTO memberships (id, user_id, campaign_id, role) VALUES ($1, $2, $3, 'campaign_admin')`,
      [crypto.randomUUID(), adminId, campaignId]
    )
    console.log(`[db] Seeded admin membership in campaign: ${campaignId}`)
  }

  // ── Migrate existing users without memberships ──────────────────
  const { rows: usersWithoutMembership } = await client.query(`
    SELECT u.id, u.campaign_id, u.role FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
    AND u.id != $1
  `, [adminId])

  for (const user of usersWithoutMembership) {
    const { rows: camp } = await client.query('SELECT id FROM campaigns WHERE id = $1', [user.campaign_id])
    const targetCampaign = camp.length > 0 ? user.campaign_id : campaignId
    const memberRole = user.role === 'admin' ? 'campaign_admin' : 'volunteer'
    await client.query(
      `INSERT INTO memberships (id, user_id, campaign_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, campaign_id) DO NOTHING`,
      [crypto.randomUUID(), user.id, targetCampaign, memberRole]
    )
  }

  if (usersWithoutMembership.length > 0) {
    console.log(`[db] Migrated ${usersWithoutMembership.length} users to memberships`)
  }

  // ── Backfill campaign_id on contacts + activity_log ──────────────
  const { rowCount: contactsBackfilled } = await client.query(
    'UPDATE contacts SET campaign_id = $1 WHERE campaign_id IS NULL', [campaignId]
  )
  if (contactsBackfilled && contactsBackfilled > 0) {
    console.log(`[db] Backfilled campaign_id on ${contactsBackfilled} contacts`)
  }

  const { rowCount: activityBackfilled } = await client.query(
    'UPDATE activity_log SET campaign_id = $1 WHERE campaign_id IS NULL', [campaignId]
  )
  if (activityBackfilled && activityBackfilled > 0) {
    console.log(`[db] Backfilled campaign_id on ${activityBackfilled} activity_log rows`)
  }
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>, campaignId?: string) {
  await pool.query(
    `INSERT INTO activity_log (user_id, action, details, campaign_id) VALUES ($1, $2, $3, $4)`,
    [userId, action, details ? JSON.stringify(details) : null, campaignId || null]
  )
}
