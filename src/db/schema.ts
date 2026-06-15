// src/db/schema.ts
// All CREATE TABLE statements. Run once on startup.

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
    contact_name      TEXT,
    ai_icebreaker     TEXT,
    ai_service_pitch  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_website_status ON leads(website_status);
  CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
  CREATE INDEX IF NOT EXISTS idx_leads_scraped_at ON leads(scraped_at);

  CREATE TABLE IF NOT EXISTS settings (
    org_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key     TEXT,
    value   TEXT NOT NULL,
    PRIMARY KEY(org_id, key)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_biz
    ON leads(org_id, business_name, city);

  CREATE TABLE IF NOT EXISTS migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS outreach (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
    org_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    body       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);

  CREATE TABLE IF NOT EXISTS email_templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event      TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_activity_lead_id ON activity(lead_id);

  CREATE TABLE IF NOT EXISTS email_accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL UNIQUE,
    app_password  TEXT NOT NULL,
    sender_name   TEXT NOT NULL,
    daily_limit   INTEGER NOT NULL DEFAULT 50,
    sent_today    INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'active',
    last_error    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scrape_targets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    label           TEXT NOT NULL,
    query           TEXT NOT NULL,
    city            TEXT NOT NULL,
    country         TEXT NOT NULL DEFAULT '',
    max_per_run     INTEGER NOT NULL DEFAULT 50,
    min_ai_score    INTEGER NOT NULL DEFAULT 0,
    website_filter  TEXT NOT NULL DEFAULT 'all',
    status          TEXT NOT NULL DEFAULT 'active',
    use_proxy       INTEGER NOT NULL DEFAULT 0,
    last_run_at     TEXT,
    next_run_at     TEXT,
    total_found     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS digest_runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
    run_at           TEXT NOT NULL DEFAULT (datetime('now')),
    targets_run      INTEGER NOT NULL DEFAULT 0,
    total_scraped    INTEGER NOT NULL DEFAULT 0,
    total_qualified  INTEGER NOT NULL DEFAULT 0,
    total_no_website INTEGER NOT NULL DEFAULT 0,
    total_new        INTEGER NOT NULL DEFAULT 0,
    digest_sent      INTEGER NOT NULL DEFAULT 0,
    digest_error     TEXT,
    top_leads        TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS idx_activity_created  ON activity(created_at);

  CREATE TABLE IF NOT EXISTS scrape_jobs (
    id            TEXT PRIMARY KEY,
    org_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
