/**
 * Migration 013: Add organizer_id to memberships
 *
 * Separates "who manages this volunteer" (organizer_id) from
 * "who originally invited them" (invited_by). Backfills from invited_by.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE memberships
    ADD COLUMN IF NOT EXISTS organizer_id TEXT REFERENCES users(id);
  `)

  // Backfill: set organizer_id = invited_by for all existing rows
  pgm.sql(`
    UPDATE memberships SET organizer_id = invited_by WHERE organizer_id IS NULL;
  `)

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_memberships_organizer ON memberships(organizer_id);
  `)
}

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_memberships_organizer;`)
  pgm.sql(`ALTER TABLE memberships DROP COLUMN IF EXISTS organizer_id;`)
}
