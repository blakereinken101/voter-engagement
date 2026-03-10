/**
 * PTG Conversations Rebuild:
 * - turfs table for geographic organizer territories
 * - entry_method + entered_by on contacts and action_items
 * - turf_id on contacts
 * - timezone on campaigns
 */

exports.up = async (pgm) => {
  // ── Turfs table ──────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS turfs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      organizer_id TEXT REFERENCES users(id),
      region TEXT,
      boundaries JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_turfs_campaign ON turfs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_turfs_organizer ON turfs(organizer_id);
  `)

  // ── Contacts: entry tracking + turf assignment ────────────────────
  pgm.sql(`
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS entry_method TEXT DEFAULT 'manual';
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS entered_by TEXT REFERENCES users(id);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS turf_id TEXT REFERENCES turfs(id);
    CREATE INDEX IF NOT EXISTS idx_contacts_turf ON contacts(turf_id) WHERE turf_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_contacts_entry_method ON contacts(campaign_id, entry_method);
  `)

  // ── Action items: entry tracking ──────────────────────────────────
  pgm.sql(`
    ALTER TABLE action_items ADD COLUMN IF NOT EXISTS entry_method TEXT DEFAULT 'manual';
    ALTER TABLE action_items ADD COLUMN IF NOT EXISTS entered_by TEXT REFERENCES users(id);
  `)

  // ── Campaigns: timezone ───────────────────────────────────────────
  pgm.sql(`
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
  `)
}

exports.down = async (pgm) => {
  pgm.sql(`ALTER TABLE campaigns DROP COLUMN IF EXISTS timezone;`)
  pgm.sql(`ALTER TABLE action_items DROP COLUMN IF EXISTS entered_by;`)
  pgm.sql(`ALTER TABLE action_items DROP COLUMN IF EXISTS entry_method;`)
  pgm.sql(`DROP INDEX IF EXISTS idx_contacts_entry_method;`)
  pgm.sql(`DROP INDEX IF EXISTS idx_contacts_turf;`)
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS turf_id;`)
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS entered_by;`)
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS entry_method;`)
  pgm.sql(`DROP INDEX IF EXISTS idx_turfs_organizer;`)
  pgm.sql(`DROP INDEX IF EXISTS idx_turfs_campaign;`)
  pgm.sql(`DROP TABLE IF EXISTS turfs;`)
}
