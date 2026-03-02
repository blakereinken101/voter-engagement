/**
 * Add settings JSONB column to memberships table.
 * Stores per-volunteer-per-campaign state like workflow mode selection.
 */

exports.up = async (pgm) => {
  pgm.sql(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';`);
};

exports.down = async (pgm) => {
  pgm.sql(`ALTER TABLE memberships DROP COLUMN IF EXISTS settings;`);
};
