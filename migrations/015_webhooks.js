/**
 * Migration 015: Create webhooks table
 *
 * Supports webhook subscriptions for real-time data push
 * to external systems (BigQuery, data warehouses, etc.)
 */
exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{}',
      secret TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_webhooks_campaign ON webhooks(campaign_id);
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(campaign_id, is_active);
  `)
}

exports.down = async (db) => {
  await db.query(`DROP TABLE IF EXISTS webhooks;`)
}
