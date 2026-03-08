/**
 * Migration: Push notification infrastructure
 * Extends push_subscriptions table to support iOS (APNs) and Android device tokens
 * alongside existing web push subscriptions.
 */
exports.up = async (pgm) => {
  // Ensure push_subscriptions table exists (was previously created inline in the subscribe route)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Add platform, device_token, and campaign_id columns
  pgm.sql(`
    ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web',
      ADD COLUMN IF NOT EXISTS device_token TEXT,
      ADD COLUMN IF NOT EXISTS campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE
  `)

  // Add check constraint for platform values
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE push_subscriptions
        ADD CONSTRAINT push_subs_platform_check
        CHECK (platform IN ('web', 'ios', 'android'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `)

  // Indexes for efficient lookup when sending notifications
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_push_subs_campaign_platform
      ON push_subscriptions(campaign_id, platform);
    CREATE INDEX IF NOT EXISTS idx_push_subs_user
      ON push_subscriptions(user_id)
  `)
}

exports.down = false
