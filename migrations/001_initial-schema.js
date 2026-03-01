/**
 * Initial schema migration — extracts all DDL from the former initSchema()
 * in src/lib/db.ts.  Every statement uses IF NOT EXISTS / IF NOT NULL guards
 * so this migration is fully idempotent and safe to run against an existing
 * production database (all statements are no-ops, then it records itself as
 * complete in the pgmigrations table).
 */

exports.up = async (pgm) => {
  // ── Users table ──────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;`);

  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
  `);

  // ── Organizations ────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
  `);

  // ── Campaigns ────────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Memberships ──────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Invitations ──────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Contacts + match_results + action_items + activity_log ────────
  pgm.sql(`
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
  `);

  // ── Product Subscriptions ──────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Events ──────────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Event RSVPs ─────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  pgm.sql(`
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS guest_phone TEXT;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
  `);

  // ── Event Comments ──────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS event_comments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES event_comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Event Reactions ─────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS event_reactions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id, user_id, emoji)
    );
  `);

  // ── Event Reminder Log ──────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS event_reminder_log (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id, reminder_type, recipient_email)
    );
  `);

  pgm.sql(`ALTER TABLE event_reminder_log ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';`);

  // Drop old unique constraint and add new one that includes channel
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'event_reminder_log_event_id_reminder_type_recipient_email_key'
      ) THEN
        ALTER TABLE event_reminder_log
          DROP CONSTRAINT event_reminder_log_event_id_reminder_type_recipient_email_key;
      END IF;
    END $$;
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_log_dedup
      ON event_reminder_log(event_id, reminder_type, recipient_email, channel);
  `);

  // ── Event Blasts ────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Voter Datasets + Voters ──────────────────────────────────────
  try {
    pgm.sql(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
  } catch (err) {
    console.warn('[migration] Could not create pg_trgm extension (fuzzy name search will be unavailable):', err.message);
  }

  pgm.sql(`
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
  `);

  // ── Indexes ──────────────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // Trigram GIN indexes for fuzzy name matching (requires pg_trgm)
  try {
    pgm.sql(`
      CREATE INDEX IF NOT EXISTS idx_voters_last_name_trgm ON voters USING gin(last_name_normalized gin_trgm_ops);
    `);
  } catch (err) {
    console.warn('[migration] Could not create trigram index (fuzzy name search will be unavailable):', err.message);
  }

  // ── VAN Integration ───────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── User Products ─────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product TEXT NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      granted_by TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      UNIQUE(user_id, product)
    );
  `);

  // Ensure CHECK constraint includes 'texting'
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_products_product_check'
      ) THEN
        ALTER TABLE user_products DROP CONSTRAINT user_products_product_check;
      END IF;
    END $$;
  `);
  pgm.sql(`
    ALTER TABLE user_products ADD CONSTRAINT user_products_product_check
      CHECK (product IN ('events', 'relational', 'texting'));
  `);

  // ── P2P Texting Platform ─────────────────────────────────────────
  pgm.sql(`
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
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_user_products_user ON user_products(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_products_product ON user_products(product, is_active);
  `);

  // ── Texting indexes ────────────────────────────────────────────
  pgm.sql(`
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
  `);

  // ── Platform Settings ─────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Make legacy columns nullable for events-only users
  pgm.sql(`
    ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
    ALTER TABLE users ALTER COLUMN campaign_id DROP NOT NULL;
  `);

  // ── Petition Sheets ───────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS petition_sheets (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      petitioner_name TEXT,
      scanned_by TEXT NOT NULL REFERENCES users(id),
      total_signatures INTEGER DEFAULT 0,
      matched_count INTEGER DEFAULT 0,
      validity_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      fingerprint TEXT,
      is_duplicate BOOLEAN DEFAULT false,
      duplicate_of TEXT,
      petitioner_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS petition_signatures (
      id TEXT PRIMARY KEY,
      sheet_id TEXT NOT NULL REFERENCES petition_sheets(id) ON DELETE CASCADE,
      line_number INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      zip TEXT,
      date_signed TEXT,
      match_status TEXT DEFAULT 'pending',
      match_data TEXT,
      match_score REAL,
      candidates_data TEXT,
      user_confirmed BOOLEAN DEFAULT false,
      confirmed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_petition_sheets_campaign ON petition_sheets(campaign_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_petition_signatures_sheet ON petition_signatures(sheet_id);
  `);

  // ── Petition Petitioners ────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS petition_petitioners (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      canonical_name TEXT NOT NULL,
      name_variants TEXT DEFAULT '[]',
      total_sheets INTEGER DEFAULT 0,
      total_signatures INTEGER DEFAULT 0,
      matched_count INTEGER DEFAULT 0,
      validity_rate REAL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_petition_petitioners_campaign ON petition_petitioners(campaign_id);
  `);

  // ── Petition schema migrations (add columns if missing) ─────────
  // NOTE: ALTER TABLEs must run BEFORE the fingerprint index, since on
  // existing databases the column doesn't exist until the migration adds it.
  pgm.sql(`
    ALTER TABLE petition_signatures ADD COLUMN IF NOT EXISTS candidates_data TEXT;
    ALTER TABLE petition_signatures ADD COLUMN IF NOT EXISTS user_confirmed BOOLEAN DEFAULT false;
    ALTER TABLE petition_signatures ADD COLUMN IF NOT EXISTS confirmed_by TEXT;
    ALTER TABLE petition_sheets ADD COLUMN IF NOT EXISTS fingerprint TEXT;
    ALTER TABLE petition_sheets ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
    ALTER TABLE petition_sheets ADD COLUMN IF NOT EXISTS duplicate_of TEXT;
    ALTER TABLE petition_sheets ADD COLUMN IF NOT EXISTS petitioner_id TEXT;
  `);

  // Fingerprint index — created after the ALTER TABLE migration above
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_petition_sheets_fingerprint ON petition_sheets(campaign_id, fingerprint);
  `);
};

exports.down = false; // Irreversible — dropping all tables would destroy data
