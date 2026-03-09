/**
 * Rename twilio_sid → provider_sid in text_messages table.
 * This is a catalog-only rename in PostgreSQL (instant, zero-downtime).
 * Historical Twilio message SIDs are preserved in the renamed column.
 */

exports.up = async (pgm) => {
  pgm.renameColumn('text_messages', 'twilio_sid', 'provider_sid')

  pgm.sql(`DROP INDEX IF EXISTS idx_text_messages_twilio_sid`)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_text_messages_provider_sid
    ON text_messages(provider_sid) WHERE provider_sid IS NOT NULL
  `)
}

exports.down = async (pgm) => {
  pgm.renameColumn('text_messages', 'provider_sid', 'twilio_sid')

  pgm.sql(`DROP INDEX IF EXISTS idx_text_messages_provider_sid`)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_text_messages_twilio_sid
    ON text_messages(twilio_sid) WHERE twilio_sid IS NOT NULL
  `)
}
