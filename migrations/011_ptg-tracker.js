/**
 * Add region column to memberships for PTG tracker organizer grouping.
 */

exports.up = async (pgm) => {
  pgm.sql(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS region TEXT;`)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_memberships_region
    ON memberships(campaign_id, region) WHERE region IS NOT NULL
  `)
}

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_memberships_region;`)
  pgm.sql(`ALTER TABLE memberships DROP COLUMN IF EXISTS region;`)
}
