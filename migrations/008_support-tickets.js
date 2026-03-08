/**
 * Support ticket system — knowledge base articles, tickets, messages, and audit events.
 */

exports.up = async (pgm) => {
  // ── Knowledge Base Articles ──────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS kb_articles (
      id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      tags TEXT[] DEFAULT '{}',
      is_published BOOLEAN DEFAULT true,
      view_count INTEGER DEFAULT 0,
      helpful_count INTEGER DEFAULT 0,
      not_helpful_count INTEGER DEFAULT 0,
      search_vector TSVECTOR,
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_kb_articles_campaign ON kb_articles(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category);
    CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(campaign_id, slug);
    CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(is_published) WHERE is_published = true;
    CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON kb_articles USING gin(search_vector);
  `);

  // Trigger to auto-update tsvector on insert/update
  pgm.sql(`
    CREATE OR REPLACE FUNCTION kb_articles_search_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    DROP TRIGGER IF EXISTS kb_articles_search_trigger ON kb_articles;
    CREATE TRIGGER kb_articles_search_trigger
      BEFORE INSERT OR UPDATE ON kb_articles
      FOR EACH ROW EXECUTE FUNCTION kb_articles_search_update();
  `);

  // ── Support Tickets ──────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      assigned_to TEXT REFERENCES users(id),
      subject TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general'
        CHECK (category IN ('general', 'technical', 'billing', 'account', 'data', 'feature-request')),
      priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in-progress', 'waiting-on-user', 'resolved', 'closed')),
      ai_conversation JSONB,
      ai_suggested_category TEXT,
      ai_suggested_priority TEXT,
      resolved_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_support_tickets_campaign ON support_tickets(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(campaign_id, status);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(campaign_id, priority, created_at DESC);
  `);

  // ── Ticket Messages ──────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      is_internal_note BOOLEAN DEFAULT false,
      ai_suggested BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at);
  `);

  // ── Ticket Events (audit log) ────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS support_ticket_events (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL
        CHECK (event_type IN ('created', 'assigned', 'status_changed', 'priority_changed', 'category_changed', 'message_sent', 'resolved', 'closed', 'reopened')),
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON support_ticket_events(ticket_id, created_at);
  `);
};

exports.down = false; // Irreversible
