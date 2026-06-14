// src/db/schema.ts
// All CREATE TABLE statements. Run once on startup.

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS leads (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name     TEXT NOT NULL,
    category          TEXT NOT NULL DEFAULT '',
    city              TEXT NOT NULL DEFAULT '',
    country           TEXT NOT NULL DEFAULT '',
    phone             TEXT,
    email             TEXT,
    email_verified    INTEGER,
    website_url       TEXT,
    google_maps_url   TEXT,
    website_status    TEXT NOT NULL DEFAULT 'unchecked',
    pagespeed_mobile  INTEGER,
    pagespeed_desktop INTEGER,
    ssl_valid         INTEGER,
    tech_stack        TEXT,
    site_built_year   INTEGER,
    ai_site_score     INTEGER,
    ai_site_summary   TEXT,
    status            TEXT NOT NULL DEFAULT 'scraped',
    flag_reason       TEXT,
    reviewer_notes    TEXT,
    outreach_channel  TEXT,
    source            TEXT NOT NULL DEFAULT 'manual',
    scraped_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    ai_personalized_hook TEXT,
    contact_name      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_website_status ON leads(website_status);
  CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
  CREATE INDEX IF NOT EXISTS idx_leads_scraped_at ON leads(scraped_at);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_biz
    ON leads(business_name, city);

  CREATE TABLE IF NOT EXISTS migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS outreach (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id          INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    step             INTEGER NOT NULL DEFAULT 1,
    channel          TEXT NOT NULL DEFAULT 'email',
    subject          TEXT,
    body             TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'queued',
    scheduled_at     TEXT NOT NULL,
    sent_at          TEXT,
    opened_at        TEXT,
    replied_at       TEXT,
    error_message    TEXT,
    smtp_message_id  TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_outreach_lead_id    ON outreach(lead_id);
  CREATE INDEX IF NOT EXISTS idx_outreach_status     ON outreach(status);
  CREATE INDEX IF NOT EXISTS idx_outreach_scheduled  ON outreach(scheduled_at);

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    body       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);

  CREATE TABLE IF NOT EXISTS email_templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event      TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_activity_lead_id  ON activity(lead_id);
  CREATE INDEX IF NOT EXISTS idx_activity_created  ON activity(created_at);

  CREATE TABLE IF NOT EXISTS scrape_jobs (
    id            TEXT PRIMARY KEY,
    query         TEXT NOT NULL,
    city          TEXT NOT NULL,
    country       TEXT NOT NULL DEFAULT '',
    max_results   INTEGER NOT NULL DEFAULT 100,
    status        TEXT NOT NULL DEFAULT 'idle',
    progress      INTEGER NOT NULL DEFAULT 0,
    found         INTEGER NOT NULL DEFAULT 0,
    errors        INTEGER NOT NULL DEFAULT 0,
    started_at    TEXT,
    completed_at  TEXT,
    error_message TEXT
  );
`
