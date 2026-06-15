// src/types/index.ts

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export type LeadStatus =
  | 'scraped' // raw, just pulled from source
  | 'qualified' // passed automated scoring
  | 'review' // in human review queue
  | 'approved' // human approved, ready for outreach
  | 'outreach' // email/DM sent
  | 'replied' // prospect replied
  | 'closed' // became a client
  | 'skipped' // rejected by human reviewer
  | 'unsubscribed' // opted out

export type WebsiteStatus =
  | 'none' // no website found
  | 'outdated' // exists but flagged as old/bad
  | 'modern' // passes quality checks
  | 'unchecked' // not yet analyzed

export type OutreachChannel = 'email' | 'linkedin' | 'phone' | 'walk_in'

export interface Lead {
  id: number
  // Identity
  business_name: string
  category: string
  city: string
  country: string
  // Contact
  phone: string | null
  email: string | null
  website_url: string | null
  google_maps_url: string | null
  // Website analysis
  website_status: WebsiteStatus
  pagespeed_mobile: number | null // 0–100
  pagespeed_desktop: number | null // 0–100
  ssl_valid: boolean | null
  tech_stack: string | null // JSON string of detected technologies
  site_built_year: number | null
  ai_site_score: number | null // 0–100, Claude's rating
  ai_site_summary: string | null // Claude's one-line reason
  // Pipeline
  status: LeadStatus
  flag_reason: string | null
  reviewer_notes: string | null
  outreach_channel: OutreachChannel | null
  // Source
  source: string // e.g. "google_maps", "yelp", "manual"
  scraped_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  ai_personalized_hook: string | null
  contact_name: string | null
  ai_icebreaker: string | null
  ai_service_pitch: string | null
  review_rating: number | null
  review_count: number | null
  social_links: string | null
  seo_metrics: string | null
  email_verified: boolean | null
  priority_score: number | null
  priority_breakdown: string | null
}

export interface EmailTemplate {
  id: number
  name: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

export interface EmailAccount {
  id: number
  email_address: string
  app_password?: string // Omit when sending to frontend ideally
  sender_name: string
  daily_limit: number
  sent_today: number
  status: string
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface EmailAccountInsert {
  email_address: string
  app_password: string
  sender_name: string
  daily_limit?: number
}

export interface LeadInsert {
  business_name: string
  category: string
  city: string
  country: string
  phone?: string | null
  email?: string | null
  website_url?: string | null
  google_maps_url?: string | null
  source: string
  website_status?: WebsiteStatus | null
  ssl_valid?: boolean | null
  ai_personalized_hook?: string | null
  contact_name?: string | null
  ai_icebreaker?: string | null
  review_rating?: number | null
  review_count?: number | null
  tech_stack?: string | null
  social_links?: string | null
  seo_metrics?: string | null
  email_verified?: boolean | null
}

export interface LeadFilters extends Partial<PaginationParams> {
  status?: LeadStatus | 'all'
  website_status?: WebsiteStatus | 'all'
  has_email?: boolean | 'all'
  email_verified?: boolean | 'all'
  city?: string
  category?: string
  search?: string
  source?: string
  sortBy?: 'scraped_at' | 'ai_site_score' | 'pagespeed_mobile' | 'site_built_year' | 'priority_score'
  sortDir?: 'asc' | 'desc'
  min_priority?: number
  date_range?: 'all' | 'today' | 'this_week' | 'this_month'
}

export interface DashboardStats {
  total_leads: number
  no_website: number
  outdated_website: number
  in_review: number
  approved: number
  closed: number
  this_week: number
  verified_emails: number
  social_links_found: number
}

export interface ChartDataPoint {
  date: string
  scraped: number
  analyzed: number
  approved: number
  closed: number
}

export interface CityRoiStat {
  city: string
  lead_count: number
  avg_ai_score: number
}

export interface AppSettings {
  proxy_enabled: boolean
  proxy_url: string
  proxy_username: string
  proxy_password: string
  claude_api_key: string
  pagespeed_api_key: string
  scrape_delay_ms: number
  max_results_per_run: number
  default_country: string
  default_city: string
  seo_audit_engine: 'pagespeed' | 'lighthouse' | 'none'
  developer_name?: string
  openrouter_api_key: string
  ai_model_site_scoring: string
  ai_model_email_draft: string
  ai_enabled: boolean

  // Phase 4: SMTP config
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_username: string
  smtp_password: string
  smtp_from_name: string
  smtp_from_email: string

  // Phase 5: Email Finder & Scheduler
  hunter_api_key: string
  email_finder_enabled: boolean
  auto_send_enabled: boolean
  auto_send_cron: string
  theme: 'dark' | 'light'

  // Advanced Scraper
  captcha_strategy: string
  two_captcha_key: string
  captcha_timeout_s: number
  scraper_headful: boolean

  // Autonomous Pipeline
  pipeline_enabled: boolean
  pipeline_scrape_cron: string
  pipeline_digest_cron: string
  digest_recipient_email: string
  digest_from_name: string
  auto_approve_threshold: number
  auto_sequence_on_approve: boolean

  discord_webhook_url: string
  
  // Phase 6: Email Templates & Cron Configs
  use_ai_for_outreach: boolean
  default_email_template_id: number | null
  imap_cron: string
  warmup_cron: string
}

// IPC channel names — typed constants, never magic strings
export const IPC = {
  LEADS_GET_ALL: 'leads:getAll',
  LEADS_GET_BY_ID: 'leads:getById',
  LEADS_INSERT: 'leads:insert',
  LEADS_UPDATE_STATUS: 'leads:updateStatus',
  LEADS_DELETE: 'leads:delete',
  STATS_GET_DASHBOARD: 'stats:getDashboard',
  STATS_GET_CITY_ROI: 'stats:getCityRoi',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SCRAPER_START: 'scraper:start',
  SCRAPER_CANCEL: 'scraper:cancel',
  SCRAPER_PAUSE: 'scraper:pause',
  SCRAPER_RESUME: 'scraper:resume',
  SCRAPER_DELETE: 'scraper:delete',
  SCRAPER_DELETE_BATCH: 'scraper:deleteBatch',
  SCRAPER_GET_JOBS: 'scraper:getJobs',
  SCRAPER_PROGRESS: 'scraper:progress',
  AI_SCORE_SITE: 'ai:scoreSite',
  AI_DRAFT_EMAIL: 'ai:draftEmail',
  AI_DRAFT_DM: 'ai:draftDm',
  ANALYSIS_RUN_LEAD: 'analysis:runLead',
  ANALYSIS_RUN_BATCH: 'analysis:runBatch',
  ANALYSIS_PROGRESS: 'analysis:progress',
  OUTREACH_SEND: 'outreach:send',
  OUTREACH_SEND_BATCH: 'outreach:sendBatch',
  OUTREACH_GET_ALL: 'outreach:getAll',
  OUTREACH_MARK_REPLIED: 'outreach:markReplied',
  OUTREACH_MARK_BOUNCED: 'outreach:markBounced',
  OUTREACH_SCHEDULE_SEQ: 'outreach:scheduleSequence',
  OUTREACH_GET_SEQUENCES: 'outreach:getSequences',
  OUTREACH_EXPORT_CSV: 'outreach:exportCsv',
  STATS_GET_CHART_DATA: 'stats:getChartData',

  // Phase 5
  EMAIL_FINDER_RUN: 'emailFinder:run',
  EMAIL_FINDER_RUN_BATCH: 'emailFinder:runBatch',
  EMAIL_VERIFIER_RUN_BATCH: 'emailVerifier:runBatch',
  NOTES_GET: 'notes:get',
  NOTES_SAVE: 'notes:save',
  ACTIVITY_GET: 'activity:get',
  ACTIVITY_GET_RECENT: 'activity:getRecent',
  SCHEDULER_STATUS: 'scheduler:status',

  EMAIL_ACCOUNTS_GET_ALL: 'emailAccounts:getAll',
  EMAIL_ACCOUNTS_ADD: 'emailAccounts:add',
  EMAIL_ACCOUNTS_UPDATE: 'emailAccounts:update',
  EMAIL_ACCOUNTS_DELETE: 'emailAccounts:delete',
  EMAIL_ACCOUNTS_TEST: 'emailAccounts:test',
  SCHEDULER_TOGGLE: 'scheduler:toggle',
  BULK_ANALYZE: 'bulk:analyze',
  BULK_APPROVE: 'bulk:approve',
  BULK_SCORE: 'bulk:score',
  BULK_SCHEDULE_SEQUENCES: 'bulk:scheduleSequences',
  TEMPLATES_GET_ALL: 'templates:getAll',
  TEMPLATES_CREATE: 'templates:create',
  TEMPLATES_UPDATE: 'templates:update',
  TEMPLATES_DELETE: 'templates:delete',

  // Pipeline
  TARGETS_GET_ALL: 'targets:getAll',
  TARGETS_INSERT: 'targets:insert',
  TARGETS_UPDATE: 'targets:update',
  TARGETS_DELETE: 'targets:delete',
  TARGETS_TOGGLE: 'targets:toggle',
  PIPELINE_RUN_NOW: 'pipeline:runNow',
  PIPELINE_GET_STATUS: 'pipeline:getStatus',
  DIGESTS_GET_ALL: 'digests:getAll',

  // Users
  USERS_LIST: 'users:list',
  USERS_ADD: 'users:add',
  USERS_UPDATE_PERMISSIONS: 'users:updatePermissions',
  USERS_DELETE: 'users:delete',
  OUTREACH_GET_PENDING_QUEUE: 'outreach:getPendingQueue'
} as const
