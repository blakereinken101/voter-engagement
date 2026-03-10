/**
 * Migration 013: Add organizer_id to memberships
 *
 * Separates "who manages this volunteer" (organizer_id) from
 * "who originally invited them" (invited_by). Backfills from invited_by.
 */
exports.up = async (db) => {
  await db.query(`
    ALTER TABLE memberships
    ADD COLUMN IF NOT EXISTS organizer_id TEXT REFERENCES users(id);
  `)

  // Backfill: set organizer_id = invited_by for all existing rows
  await db.query(`
    UPDATE memberships SET organizer_id = invited_by WHERE organizer_id IS NULL;
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_memberships_organizer ON memberships(organizer_id);
  `)
}

exports.down = async (db) => {
  await db.query(`DROP INDEX IF EXISTS idx_memberships_organizer;`)
  await db.query(`ALTER TABLE memberships DROP COLUMN IF EXISTS organizer_id;`)
}
