exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS contact_event_rsvps (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
      notes TEXT,
      recorded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(contact_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_contact_event_rsvps_contact ON contact_event_rsvps(contact_id);
    CREATE INDEX IF NOT EXISTS idx_contact_event_rsvps_event ON contact_event_rsvps(event_id);
  `)
}

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS contact_event_rsvps;`)
}
