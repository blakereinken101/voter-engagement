/**
 * Team messaging — channels, members, messages, and DMs.
 * Adds 'messaging' to the user_products CHECK constraint.
 */

exports.up = async (pgm) => {
  // ── Messaging Channels ──────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS messaging_channels (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT,
      channel_type TEXT NOT NULL DEFAULT 'team'
        CHECK (channel_type IN ('team', 'broadcast', 'direct')),
      description TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      is_archived BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Channel Members ─────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS messaging_channel_members (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES messaging_channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      muted BOOLEAN DEFAULT false,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(channel_id, user_id)
    );
  `);

  // ── Messages ────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS messaging_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES messaging_channels(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text'
        CHECK (message_type IN ('text', 'system', 'announcement')),
      parent_id TEXT REFERENCES messaging_messages(id) ON DELETE SET NULL,
      is_edited BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Indexes ─────────────────────────────────────────────────────
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_messaging_channels_campaign ON messaging_channels(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_messaging_channels_type ON messaging_channels(campaign_id, channel_type);
    CREATE INDEX IF NOT EXISTS idx_messaging_channel_members_channel ON messaging_channel_members(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messaging_channel_members_user ON messaging_channel_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messaging_messages_channel ON messaging_messages(channel_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messaging_messages_sender ON messaging_messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messaging_messages_parent ON messaging_messages(parent_id) WHERE parent_id IS NOT NULL;
  `);

  // ── Update user_products CHECK constraint to include 'messaging' ─
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
      CHECK (product IN ('events', 'relational', 'texting', 'messaging'));
  `);
};

exports.down = false; // Irreversible
