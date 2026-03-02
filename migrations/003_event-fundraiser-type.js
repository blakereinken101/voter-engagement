exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE events ADD COLUMN IF NOT EXISTS fundraiser_type TEXT;`)
}

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE events DROP COLUMN IF EXISTS fundraiser_type;`)
}
