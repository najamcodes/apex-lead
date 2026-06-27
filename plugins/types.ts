// plugins/types.ts
// Core plugin interface definitions for LeadHunter's plugin system.
// All plugins must implement one of: ScraperPlugin | EnricherPlugin | ConnectorPlugin

import type { ZodTypeAny } from 'zod'

// ─────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────

/** Read-only snapshot of a lead passed to enricher plugins. */
export interface LeadSnapshot {
  id: number
  org_id: number
  business_name: string
  category: string
  city: string
  country: string
  phone: string | null
  email: string | null
  website_url: string | null
  google_maps_url: string | null
  website_status: string | null
  ssl_valid: boolean | null
  tech_stack: string | null          // JSON-serialised array
  social_links: string | null        // JSON-serialised object
  review_rating: number | null
  review_count: number | null
  ai_site_score: number | null
  status: string
  source: string
  scraped_at: string
}

/** Fields an enricher plugin is allowed to write back to the lead. */
export interface LeadEnrichment {
  email: string | null
  email_verified: boolean | null
  contact_name: string | null
  phone: string | null
  website_url: string | null
  website_status: string | null
  ssl_valid: boolean | null
  tech_stack: string | null
  social_links: string | null
  ai_site_score: number | null
  ai_site_summary: string | null
  ai_personalized_hook: string | null
  ai_icebreaker: string | null
  review_rating: number | null
  review_count: number | null
  pagespeed_mobile: number | null
  pagespeed_desktop: number | null
  site_built_year: number | null
  seo_metrics: string | null
  priority_score: number | null
}

/** A generic scraped item produced by a scraper plugin before DB insertion. */
export interface ScrapedItem {
  /** The pipeline this item belongs to, e.g. 'lead', 'amazon_product', 'facebook_post' */
  pipeline: string
  /** The actual scraped data payload */
  data: Record<string, unknown>
}

/** A raw lead produced by a scraper plugin before DB insertion. */
export interface RawLead {
  business_name: string
  category: string
  city: string
  country: string
  phone: string | null
  email: string | null
  website_url: string | null
  google_maps_url: string | null
  review_rating: number | null
  review_count: number | null
  source: string                     // plugin id, e.g. 'yelp'
  raw_data?: Record<string, unknown> // plugin-specific extras, not persisted
}

/** Config passed to a scraper plugin per run. */
export interface ScraperRunConfig {
  query: string
  city: string
  country: string
  max_results: number
  use_proxy: boolean
  website_filter?: 'all' | 'required' | 'none'
  phone_filter?: 'all' | 'required' | 'none'
  email_filter?: 'all' | 'required' | 'none'
  pluginConfig: Record<string, unknown>
  onProgress?: (found: number, current: string) => void
  isCancelled?: () => boolean  // plugin-specific settings
}

/** Event envelope fired to connector plugins. */
export interface PluginEvent {
  trigger: PluginTrigger
  org_id: number
  lead: LeadSnapshot
  metadata?: Record<string, unknown>     // e.g. outreach step, reply body
}

export type PluginTrigger =
  | 'lead.created'
  | 'lead.qualified'
  | 'lead.approved'
  | 'lead.skipped'
  | 'lead.closed'
  | 'outreach.sent'
  | 'outreach.replied'
  | 'outreach.bounced'

// ─────────────────────────────────────────────────────────────────
// Plugin interfaces
// ─────────────────────────────────────────────────────────────────

export interface PluginBase {
  /** Unique stable identifier, e.g. 'google-maps', 'clearbit', 'hubspot'. */
  id: string
  /** Display name. */
  name: string
  /** SemVer string. */
  version: string
  /** Human-readable description shown in the plugin list UI. */
  description: string
  /** Author name or org. */
  author: string
  /** Zod schema validating the plugin-specific config object. */
  configSchema: ZodTypeAny
}

/** Scraper plugin — produces raw leads from any source. */
export interface ScraperPlugin extends PluginBase {
  kind: 'scraper'
  /**
   * Yields scraped items from the data source.
   * Must be an async generator so the caller can process items
   * incrementally and apply cancellation between yields.
   */
  scrape(config: ScraperRunConfig): AsyncGenerator<ScrapedItem>
}

/** Enricher plugin — adds data fields to an existing lead. */
export interface EnricherPlugin extends PluginBase {
  kind: 'enricher'
  /**
   * Returns a partial LeadEnrichment to be merged onto the lead,
   * or null to skip (e.g. plugin disabled, lead ineligible).
   */
  enrich(lead: LeadSnapshot, config: Record<string, unknown>): Promise<Partial<LeadEnrichment> | null>
}

/** Connector plugin — pushes events to external systems. */
export interface ConnectorPlugin extends PluginBase {
  kind: 'connector'
  /** List of triggers this connector cares about. */
  on: PluginTrigger[]
  /**
   * Push the event to the external system.
   * Errors are caught and logged by the runner — never throw for retryable failures.
   */
  push(event: PluginEvent, config: Record<string, unknown>): Promise<void>
}

export type Plugin = ScraperPlugin | EnricherPlugin | ConnectorPlugin
export type PluginKind = Plugin['kind']

// ─────────────────────────────────────────────────────────────────
// Plugin manifest (plugin.json)
// ─────────────────────────────────────────────────────────────────

/**
 * Loaded from plugin.json alongside the plugin's entry file.
 * Validated with Zod at load time.
 */
export interface PluginManifest {
  id: string
  kind: PluginKind
  name: string
  version: string
  description: string
  author: string
  /** Relative path to the plugin entry file from the manifest directory. */
  main: string
  /** Whether the plugin is enabled by default on first load. */
  enabledByDefault: boolean
  /** Tags for display / filtering in the UI. */
  tags?: string[]
}

// ─────────────────────────────────────────────────────────────────
// Registry record (runtime)
// ─────────────────────────────────────────────────────────────────

export interface PluginRecord {
  manifest: PluginManifest
  plugin: Plugin
  /** Resolved from DB / settings at startup. */
  enabled: boolean
  /** Parsed config from DB, validated against plugin.configSchema. */
  config: Record<string, unknown>
  /** Absolute path to the plugin directory. */
  dir: string
  /** 'built-in' | 'user' */
  source: 'built-in' | 'user'
  /** Set if the plugin failed to load. */
  loadError?: string
}


