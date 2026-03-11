/**
 * Migration 014: Add confidence column to match_results
 *
 * Surfaces match confidence as a top-level column for efficient
 * querying/sorting in the PTG conversations spreadsheet.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE match_results
    ADD COLUMN IF NOT EXISTS confidence TEXT;
  `)

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_match_results_status ON match_results(status);
  `)

  // Backfill confidence from existing data
  pgm.sql(`
    UPDATE match_results
    SET confidence = CASE
      WHEN status = 'confirmed' THEN 'high'
      WHEN status = 'ambiguous' AND best_match_data IS NOT NULL THEN 'medium'
      WHEN status = 'ambiguous' THEN 'low'
      WHEN status = 'unmatched' THEN NULL
      ELSE NULL
    END
    WHERE confidence IS NULL;
  `)
}

exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_match_results_status;`)
  pgm.sql(`ALTER TABLE match_results DROP COLUMN IF EXISTS confidence;`)
}
