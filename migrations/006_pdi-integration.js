exports.up = (pgm) => {
  pgm.sql(`
    -- PDI ID columns (parallel to van_id / van_event_id)
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pdi_id BIGINT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS pdi_event_id BIGINT;
    CREATE INDEX IF NOT EXISTS idx_contacts_pdi_id ON contacts(pdi_id) WHERE pdi_id IS NOT NULL;

    -- PDI sync log (same structure as van_sync_log)
    CREATE TABLE IF NOT EXISTS pdi_sync_log (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      pdi_endpoint TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      pdi_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pdi_sync_log_campaign ON pdi_sync_log(campaign_id, created_at DESC);
  `)
}

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS pdi_sync_log;
    DROP INDEX IF EXISTS idx_contacts_pdi_id;
    ALTER TABLE contacts DROP COLUMN IF EXISTS pdi_id;
    ALTER TABLE events DROP COLUMN IF EXISTS pdi_event_id;
  `)
}
