import { getEnabledScrapers, getEnabledEnrichers, getEnabledConnectors } from './registry'
import type {
  ScrapedItem,
  LeadSnapshot,
  LeadEnrichment,
  PluginEvent,
  PluginTrigger,
  ScraperPlugin,
  EnricherPlugin,
  ConnectorPlugin,
  ScraperRunConfig,
} from './types'

// ─────────────────────────────────────────────────────────────────
// Scraper runner
// ─────────────────────────────────────────────────────────────────

export async function* runExtraScrapers(
  config: ScraperRunConfig,
  exclude: string[] = [],
): AsyncGenerator<ScrapedItem> {
  const scrapers = getEnabledScrapers().filter(r => !exclude.includes(r.manifest.id))

  for (const record of scrapers) {
    const plugin = record.plugin as ScraperPlugin
    console.log(`[runner] Scraper plugin ${plugin.id} starting for query: ${config.query}`)
    try {
      for await (const lead of plugin.scrape({ ...config, pluginConfig: record.config })) {
        yield lead
      }
    } catch (err) {
      console.error(`[runner] Scraper plugin ${plugin.id} failed:`, err)
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Enricher runner
// ─────────────────────────────────────────────────────────────────

export async function runEnrichers(
  lead: LeadSnapshot,
  exclude: string[] = [],
): Promise<Partial<LeadEnrichment>> {
  const enrichers = getEnabledEnrichers().filter(r => !exclude.includes(r.manifest.id))

  const results = await Promise.allSettled(
    enrichers.map(async (record) => {
      const plugin = record.plugin as EnricherPlugin
      try {
        return await plugin.enrich(lead, record.config)
      } catch (err) {
        console.error(`[runner] Enricher plugin ${plugin.id} failed for lead ${lead.id}:`, err)
        return null
      }
    })
  )

  const merged: Partial<LeadEnrichment> = {}
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      Object.assign(merged, result.value)
    }
  }
  return merged
}

// ─────────────────────────────────────────────────────────────────
// Connector runner
// ─────────────────────────────────────────────────────────────────

export async function fireConnectors(
  trigger: PluginTrigger,
  lead: LeadSnapshot,
  metadata?: Record<string, unknown>,
): Promise<{ fired: number; errors: number }> {
  const connectors = getEnabledConnectors(trigger)
  if (connectors.length === 0) return { fired: 0, errors: 0 }

  const event: PluginEvent = {
    trigger,
    org_id: lead.org_id,
    lead,
    metadata,
  }

  let fired = 0
  let errors = 0

  const results = await Promise.allSettled(
    connectors.map(record => {
      const plugin = record.plugin as ConnectorPlugin
      return plugin.push(event, record.config)
    })
  )

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      fired++
    } else {
      errors++
      console.error(
        `[runner] Connector ${connectors[i].manifest.id} failed on trigger ${trigger} for lead ${lead.id}:`,
        (results[i] as PromiseRejectedResult).reason
      )
    }
  }

  if (fired > 0 || errors > 0) {
    console.log(`[runner] Connectors fired for ${trigger}: ${fired} ok, ${errors} failed`)
  }

  return { fired, errors }
}

export function makeLeadSnapshot(row: Record<string, unknown>): LeadSnapshot {
  return {
    id:             row.id as number,
    org_id:         row.org_id as number,
    business_name:  row.business_name as string,
    category:       (row.category as string) ?? '',
    city:           (row.city as string) ?? '',
    country:        (row.country as string) ?? '',
    phone:          (row.phone as string | null) ?? null,
    email:          (row.email as string | null) ?? null,
    website_url:    (row.website_url as string | null) ?? null,
    google_maps_url: (row.google_maps_url as string | null) ?? null,
    website_status: (row.website_status as string | null) ?? null,
    ssl_valid:      (row.ssl_valid as boolean | null) ?? null,
    tech_stack:     (row.tech_stack as string | null) ?? null,
    social_links:   (row.social_links as string | null) ?? null,
    review_rating:  (row.review_rating as number | null) ?? null,
    review_count:   (row.review_count as number | null) ?? null,
    ai_site_score:  (row.ai_site_score as number | null) ?? null,
    status:         (row.status as string) ?? 'scraped',
    source:         (row.source as string) ?? 'unknown',
    scraped_at:     (row.scraped_at as string) ?? new Date().toISOString(),
  }
}
