import { Pool } from 'pg'
import { hashSync } from 'bcryptjs'
import { PLAN_LIMITS } from '@/types/events'

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

let _initPromise: Promise<void> | null = null

export function getPool(): Pool {
  return pool
}

export async function getDb(): Promise<Pool> {
  if (!_initPromise) {
    _initPromise = initSchema()
  }
  await _initPromise
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

    // SMS fields on users
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
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

    // Add description + logo_url to organizations (for vanity URL pages)
    await client.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
    `)

    // ── Campaigns ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        candidate_name TEXT,
        state TEXT NOT NULL,
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
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS volunteer_interest TEXT;
      UPDATE action_items SET volunteer_interest = 'yes' WHERE is_volunteer_prospect = 1 AND volunteer_interest IS NULL;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS campaign_id TEXT REFERENCES campaigns(id);
      ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS campaign_id TEXT;

      CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER DEFAULT 0,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'two_factor';

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        tool_calls JSONB,
        tool_results JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Product Subscriptions (events SaaS gating) ──────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_subscriptions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        product TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        stripe_subscription_id TEXT,
        stripe_customer_id TEXT,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        limits JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, product)
      );
    `)

    // ── Events ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        event_type TEXT NOT NULL DEFAULT 'community',
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        timezone TEXT NOT NULL DEFAULT 'America/New_York',
        location_name TEXT,
        location_address TEXT,
        location_city TEXT,
        location_state TEXT,
        location_zip TEXT,
        is_virtual BOOLEAN DEFAULT false,
        virtual_url TEXT,
        cover_image_url TEXT,
        emoji TEXT DEFAULT '🗳️',
        theme_color TEXT DEFAULT '#6C3CE1',
        visibility TEXT NOT NULL DEFAULT 'public',
        max_attendees INTEGER,
        rsvp_enabled BOOLEAN DEFAULT true,
        status TEXT NOT NULL DEFAULT 'published',
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Event RSVPs ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_rsvps (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        guest_name TEXT,
        guest_email TEXT,
        status TEXT NOT NULL DEFAULT 'going',
        guest_count INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );
    `)

    // SMS opt-in fields for event RSVPs
    await client.query(`
      ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS guest_phone TEXT;
      ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
    `)

    // ── Event Comments ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_comments (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES event_comments(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Event Reactions ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_reactions (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(event_id, user_id, emoji)
      );
    `)

    // ── Event Reminder Log ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_reminder_log (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        reminder_type TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(event_id, reminder_type, recipient_email)
      );
    `)

    // Add channel column for SMS vs email dedup
    await client.query(`
      ALTER TABLE event_reminder_log ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';
    `)

    // Drop old unique constraint and add new one that includes channel
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'event_reminder_log_event_id_reminder_type_recipient_email_key'
        ) THEN
          ALTER TABLE event_reminder_log
            DROP CONSTRAINT event_reminder_log_event_id_reminder_type_recipient_email_key;
        END IF;
      END $$;
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_log_dedup
        ON event_reminder_log(event_id, reminder_type, recipient_email, channel);
    `)

    // ── Event Blasts ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_blasts (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        sent_by TEXT NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'both',
        emails_sent INTEGER DEFAULT 0,
        sms_sent INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Voter Datasets + Voters (DB-backed voter file storage) ──────
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
    } catch (err) {
      console.warn('[db] Could not create pg_trgm extension (fuzzy name search will be unavailable):', (err as Error).message)
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS voter_datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        state TEXT NOT NULL,
        geography_type TEXT NOT NULL DEFAULT 'state',
        geography_name TEXT,
        record_count INTEGER DEFAULT 0,
        uploaded_by TEXT REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'processing',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS voters (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES voter_datasets(id) ON DELETE CASCADE,
        voter_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT,
        gender TEXT,
        residential_address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        party_affiliation TEXT,
        registration_date TEXT,
        voter_status TEXT,
        vh2024g TEXT DEFAULT '',
        vh2022g TEXT DEFAULT '',
        vh2020g TEXT DEFAULT '',
        vh2024p TEXT DEFAULT '',
        vh2022p TEXT DEFAULT '',
        vh2020p TEXT DEFAULT '',
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        last_name_normalized TEXT,
        last_name_metaphone TEXT,
        UNIQUE(dataset_id, voter_id)
      );

      CREATE TABLE IF NOT EXISTS campaign_voter_datasets (
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        dataset_id TEXT NOT NULL REFERENCES voter_datasets(id) ON DELETE CASCADE,
        PRIMARY KEY (campaign_id, dataset_id)
      );

      ALTER TABLE voters ADD COLUMN IF NOT EXISTS congressional_district TEXT;
      ALTER TABLE voters ADD COLUMN IF NOT EXISTS state_senate_district TEXT;
      ALTER TABLE voters ADD COLUMN IF NOT EXISTS state_house_district TEXT;

      ALTER TABLE campaign_voter_datasets ADD COLUMN IF NOT EXISTS filter_congressional TEXT;
      ALTER TABLE campaign_voter_datasets ADD COLUMN IF NOT EXISTS filter_state_senate TEXT;
      ALTER TABLE campaign_voter_datasets ADD COLUMN IF NOT EXISTS filter_state_house TEXT;
      ALTER TABLE campaign_voter_datasets ADD COLUMN IF NOT EXISTS filter_city TEXT;
      ALTER TABLE campaign_voter_datasets ADD COLUMN IF NOT EXISTS filter_zip TEXT;
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
      CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_user_campaign ON chat_messages(user_id, campaign_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_product_subscriptions_org ON product_subscriptions(organization_id);
      CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(organization_id);
      CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
      CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
      CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
      CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
      CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON event_comments(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_reactions_event_id ON event_reactions(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_reminder_log_event_id ON event_reminder_log(event_id);

      CREATE INDEX IF NOT EXISTS idx_voters_dataset_id ON voters(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_voters_last_name_norm ON voters(dataset_id, last_name_normalized);
      CREATE INDEX IF NOT EXISTS idx_voters_last_name_metaphone ON voters(dataset_id, last_name_metaphone);
      CREATE INDEX IF NOT EXISTS idx_voters_zip ON voters(dataset_id, zip);
      CREATE INDEX IF NOT EXISTS idx_voters_status ON voters(dataset_id, voter_status);
      CREATE INDEX IF NOT EXISTS idx_voters_dataset_voter ON voters(dataset_id, voter_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_voter_datasets_campaign ON campaign_voter_datasets(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_voter_datasets_dataset ON campaign_voter_datasets(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_voters_state_house ON voters(dataset_id, state_house_district);

    `)

    // Trigram GIN indexes for fuzzy name matching (requires pg_trgm)
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_voters_last_name_trgm ON voters USING gin(last_name_normalized gin_trgm_ops);
      `)
    } catch (err) {
      console.warn('[db] Could not create trigram index (fuzzy name search will be unavailable):', (err as Error).message)
    }

    // ── VAN Integration ───────────────────────────────────────────────
    await client.query(`
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS van_id BIGINT;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS van_event_id BIGINT;

      CREATE TABLE IF NOT EXISTS van_sync_log (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        van_endpoint TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        van_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_van_id ON contacts(van_id) WHERE van_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_van_sync_log_campaign ON van_sync_log(campaign_id, created_at DESC);
    `)

    // ── User Products (product-level access control) ─────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_products (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product TEXT NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        granted_by TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        UNIQUE(user_id, product)
      );
    `)

    // Ensure CHECK constraint includes 'texting'
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_products_product_check'
        ) THEN
          ALTER TABLE user_products DROP CONSTRAINT user_products_product_check;
        END IF;
      END $$;
    `)
    await client.query(`
      ALTER TABLE user_products ADD CONSTRAINT user_products_product_check
        CHECK (product IN ('events', 'relational', 'texting'));
    `)

    // ── P2P Texting Platform ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS text_campaigns (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
        sending_mode TEXT NOT NULL DEFAULT 'p2p' CHECK (sending_mode IN ('p2p','blast')),
        texting_hours_start INTEGER NOT NULL DEFAULT 9,
        texting_hours_end INTEGER NOT NULL DEFAULT 21,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS text_campaign_settings (
        id TEXT PRIMARY KEY,
        text_campaign_id TEXT NOT NULL UNIQUE REFERENCES text_campaigns(id) ON DELETE CASCADE,
        dynamic_assignment_initials BOOLEAN DEFAULT false,
        dynamic_assignment_replies BOOLEAN DEFAULT false,
        initial_batch_size INTEGER DEFAULT 200,
        reply_batch_size INTEGER DEFAULT 50,
        enable_contact_notes BOOLEAN DEFAULT true,
        enable_manual_tags BOOLEAN DEFAULT true,
        initial_join_token TEXT UNIQUE,
        reply_join_token TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS text_campaign_contacts (
        id TEXT PRIMARY KEY,
        text_campaign_id TEXT NOT NULL REFERENCES text_campaigns(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        cell TEXT NOT NULL,
        custom_fields JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','sent','replied','opted_out','error')),
        assigned_to TEXT REFERENCES users(id),
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS text_campaign_scripts (
        id TEXT PRIMARY KEY,
        text_campaign_id TEXT NOT NULL REFERENCES text_campaigns(id) ON DELETE CASCADE,
        script_type TEXT NOT NULL CHECK (script_type IN ('initial','canned_response')),
        title TEXT,
        body TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        tags TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS text_messages (
        id TEXT PRIMARY KEY,
        text_campaign_id TEXT NOT NULL REFERENCES text_campaigns(id) ON DELETE CASCADE,
        contact_id TEXT NOT NULL REFERENCES text_campaign_contacts(id) ON DELETE CASCADE,
        sender_id TEXT REFERENCES users(id),
        direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','received')),
        twilio_sid TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS text_campaign_tags (
        id TEXT PRIMARY KEY,
        text_campaign_id TEXT NOT NULL REFERENCES text_campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6C3CE1',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(text_campaign_id, name)
      );

      CREATE TABLE IF NOT EXISTS text_contact_tags (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL REFERENCES text_campaign_contacts(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES text_campaign_tags(id) ON DELETE CASCADE,
        applied_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(contact_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS text_contact_notes (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL REFERENCES text_campaign_contacts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id),
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS text_opt_outs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        reason TEXT,
        source TEXT DEFAULT 'auto',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, phone)
      );

      CREATE TABLE IF NOT EXISTS text_campaign_members (
        id TEXT PRIMARY KEY,
        text_campaign_id TEXT NOT NULL REFERENCES text_campaigns(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'texter' CHECK (role IN ('admin','texter')),
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        UNIQUE(text_campaign_id, user_id)
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_products_user ON user_products(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_products_product ON user_products(product, is_active);
    `)

    // ── Texting indexes (must come after texting table creation) ────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_text_campaigns_org ON text_campaigns(organization_id);
      CREATE INDEX IF NOT EXISTS idx_text_campaigns_status ON text_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_contacts_campaign ON text_campaign_contacts(text_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_contacts_status ON text_campaign_contacts(text_campaign_id, status);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_contacts_assigned ON text_campaign_contacts(text_campaign_id, assigned_to);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_contacts_cell ON text_campaign_contacts(text_campaign_id, cell);
      CREATE INDEX IF NOT EXISTS idx_text_messages_campaign ON text_messages(text_campaign_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_text_messages_contact ON text_messages(contact_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_text_messages_twilio_sid ON text_messages(twilio_sid) WHERE twilio_sid IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_text_opt_outs_org_phone ON text_opt_outs(organization_id, phone);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_members_campaign ON text_campaign_members(text_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_members_user ON text_campaign_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_scripts_campaign ON text_campaign_scripts(text_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_text_campaign_settings_campaign ON text_campaign_settings(text_campaign_id);
    `)

    // ── Platform Settings (key-value store for admin config) ─────
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Make legacy columns nullable for events-only users (no campaign needed)
    await client.query(`
      ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
      ALTER TABLE users ALTER COLUMN campaign_id DROP NOT NULL;
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
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || (
    process.env.NODE_ENV === 'production' ? '' : 'changeme123'
  )
  const { rows: existingAdmin } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])

  let adminId: string | null = null
  if (existingAdmin.length === 0 && adminPassword) {
    adminId = crypto.randomUUID()
    const passwordHash = hashSync(adminPassword, 10)
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, campaign_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, 'admin', $5, true)`,
      [adminId, adminEmail, passwordHash, 'Admin', campaignId]
    )
    console.log(`[db] Seeded admin user: ${adminEmail}`)
  } else if (existingAdmin.length === 0) {
    console.warn('[db] No ADMIN_SEED_PASSWORD set — skipping admin user creation')
  } else {
    adminId = existingAdmin[0].id as string
    await client.query('UPDATE users SET is_platform_admin = true WHERE id = $1', [adminId])
  }

  if (adminId) {
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

    // Ensure admin has all product access grants
    for (const product of ['events', 'relational', 'texting']) {
      await client.query(
        `INSERT INTO user_products (id, user_id, product)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product) DO NOTHING`,
        [crypto.randomUUID(), adminId, product]
      )
    }
  }

  // ── Backfill relational product for all users who have memberships ──
  // (handles existing users who were created before the user_products table)
  const { rowCount: relationalBackfilled } = await client.query(`
    INSERT INTO user_products (id, user_id, product)
    SELECT gen_random_uuid(), m.user_id, 'relational'
    FROM memberships m
    WHERE m.is_active = true
    ON CONFLICT (user_id, product) DO NOTHING
  `)
  if (relationalBackfilled && relationalBackfilled > 0) {
    console.log(`[db] Backfilled relational product for ${relationalBackfilled} users with memberships`)
  }

  // ── Migrate existing users without memberships (legacy relational users only) ──
  const { rows: usersWithoutMembership } = await client.query(`
    SELECT u.id, u.campaign_id, u.role FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
    AND u.campaign_id IS NOT NULL
    ${adminId ? 'AND u.id != $1' : ''}
  `, adminId ? [adminId] : [])

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
    // Also grant relational product to these newly-migrated users
    await client.query(
      `INSERT INTO user_products (id, user_id, product)
       VALUES ($1, $2, 'relational')
       ON CONFLICT (user_id, product) DO NOTHING`,
      [crypto.randomUUID(), user.id]
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

  // ── Seed events subscription for default org ─────────────────
  const { rows: existingSub } = await client.query(
    "SELECT id FROM product_subscriptions WHERE organization_id = $1 AND product = 'events'",
    [orgId]
  )
  if (existingSub.length === 0) {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    await client.query(
      `INSERT INTO product_subscriptions (id, organization_id, product, plan, status, current_period_start, current_period_end, limits)
       VALUES ($1, $2, 'events', 'scale', 'active', $3, $4, $5)`,
      [crypto.randomUUID(), orgId, now.toISOString(), periodEnd.toISOString(), JSON.stringify(PLAN_LIMITS.scale)]
    )
    console.log(`[db] Seeded default events subscription (scale) for org: ${orgId}`)
  }

  // ── Seed placeholder events ──────────────────────────────────
  if (adminId) {
    await seedEvents(client, orgId, adminId)
  }
}

async function seedEvents(client: import('pg').PoolClient, orgId: string, adminId: string) {
  const { rows: existing } = await client.query(
    'SELECT COUNT(*) FROM events WHERE organization_id = $1',
    [orgId]
  )
  if (parseInt(existing[0].count, 10) > 0) return

  function seedSlug(title: string): string {
    const base = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    const suffix = crypto.randomUUID().slice(0, 6)
    return `${base}-${suffix}`
  }

  function futureDate(daysFromNow: number, hour: number, minute = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }

  function endDate(daysFromNow: number, hour: number, minute = 0): string {
    return futureDate(daysFromNow, hour, minute)
  }

  const events = [
    {
      title: 'New Volunteer Orientation',
      description: 'New to organizing? Start here! This orientation covers everything you need to know to get involved: how to canvass, phone bank, register voters, and make a real impact in your community. Snacks and materials provided.',
      event_type: 'volunteer_training',
      start_time: futureDate(4, 17, 30),
      end_time: endDate(4, 19, 30),
      location_name: 'Downtown Organizing HQ',
      location_city: 'Charlotte',
      location_state: 'NC',
      location_zip: '28202',
      is_virtual: false,
      emoji: '📋',
      theme_color: '#6C3CE1',
      max_attendees: 40,
    },
    {
      title: 'Community Cleanup & Voter Contact',
      description: 'Make a visible difference in your neighborhood! We\'ll spend the morning cleaning up the park and the afternoon talking to neighbors about upcoming elections. Community service meets civic engagement.',
      event_type: 'community',
      start_time: futureDate(12, 9, 0),
      end_time: endDate(12, 15, 0),
      location_name: 'Riverside Park',
      location_city: 'Milwaukee',
      location_state: 'WI',
      location_zip: '53212',
      is_virtual: false,
      emoji: '🌟',
      theme_color: '#14B8A6',
      max_attendees: 50,
    },
    {
      title: 'Voter Registration Drive',
      description: 'Every vote counts — and it starts with registration. Join us to register new voters, check registrations, and make sure every eligible citizen can make their voice heard. Volunteers will be stationed at community centers, libraries, and college campuses.',
      event_type: 'voter_registration',
      start_time: futureDate(9, 9, 0),
      end_time: endDate(9, 17, 0),
      location_name: 'Multiple Locations',
      location_city: 'Phoenix',
      location_state: 'AZ',
      location_zip: '85001',
      is_virtual: false,
      emoji: '📝',
      theme_color: '#14B8A6',
      max_attendees: 100,
    },
    {
      title: 'Ballot Party: Know Your Candidates',
      description: 'Don\'t show up to the polls unprepared! Join us for an interactive ballot walkthrough. We\'ll cover every race on the ballot, research candidates together, and make sure you\'re ready to vote informed all the way down-ballot.',
      event_type: 'ballot_party',
      start_time: futureDate(16, 18, 0),
      end_time: endDate(16, 20, 30),
      location_name: 'Community Library',
      location_city: 'Atlanta',
      location_state: 'GA',
      location_zip: '30303',
      is_virtual: false,
      emoji: '🗳️',
      theme_color: '#F59E0B',
      max_attendees: 60,
    },
  ]

  for (const event of events) {
    const id = crypto.randomUUID()
    const slug = seedSlug(event.title)
    await client.query(
      `INSERT INTO events (
        id, organization_id, created_by, title, description, event_type,
        start_time, end_time, timezone,
        location_name, location_address, location_city, location_state, location_zip,
        is_virtual, virtual_url,
        cover_image_url, emoji, theme_color,
        visibility, max_attendees, rsvp_enabled, status, slug
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, 'America/New_York',
        $9, $10, $11, $12, $13,
        $14, $15,
        NULL, $16, $17,
        'public', $18, true, 'published', $19
      )`,
      [
        id, orgId, adminId, event.title, event.description, event.event_type,
        event.start_time, event.end_time || null,
        event.location_name || null, (event as Record<string, unknown>).location_address as string || null,
        event.location_city || null, event.location_state || null, event.location_zip || null,
        event.is_virtual, (event as Record<string, unknown>).virtual_url as string || null,
        event.emoji, event.theme_color,
        event.max_attendees || null, slug
      ]
    )
  }

  console.log(`[db] Seeded ${events.length} placeholder events`)
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>, campaignId?: string) {
  await pool.query(
    `INSERT INTO activity_log (user_id, action, details, campaign_id) VALUES ($1, $2, $3, $4)`,
    [userId, action, details ? JSON.stringify(details) : null, campaignId || null]
  )
}
