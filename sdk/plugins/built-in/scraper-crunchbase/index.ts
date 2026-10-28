// plugins/built-in/scraper-crunchbase/index.ts
// LeadHunter Scraper Plugin: Crunchbase Venture Capital & Startups

import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'
import { scrapeCrunchbase, type ScrapeControlToken } from './crunchbase'

const ConfigSchema = z.object({
  proxy_url: z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
  simulate: z.boolean().default(false),
})

const crunchbasePlugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'scraper-crunchbase',
  name: 'Crunchbase Venture Capital & Startup Scraper',
  version: '1.0.0',
  description: 'Scrapes venture-funded tech startups, funding rounds (Series A/B/C), lead investors, valuation estimates, and executive leadership from Crunchbase.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async *scrape(config: ScraperRunConfig): AsyncGenerator<ScrapedItem> {
    const pluginCfg = ConfigSchema.parse(config.pluginConfig || {})
    const isSimulate = pluginCfg.simulate || Boolean(config.pluginConfig?.simulate)

    let context: any = null

    if (!isSimulate) {
      try {
        const { createStealthContext } = await import('@sdk/core/scraper/stealth')
        const rawProxy = config.proxyConfig || (pluginCfg.proxy_url
          ? {
              server: pluginCfg.proxy_url,
              username: pluginCfg.proxy_username,
              password: pluginCfg.proxy_password,
            }
          : null)

        const proxyConfig = rawProxy ? {
          server: rawProxy.server,
          username: rawProxy.username || undefined,
          password: rawProxy.password || undefined,
        } : null

        const stealth = await createStealthContext(proxyConfig, !pluginCfg.headful)
        context = stealth.context
      } catch {
        context = null
      }
    }

    try {
      const cancelToken: ScrapeControlToken = {
        get cancelled() { return config.isCancelled ? config.isCancelled() : false },
        paused: false,
      }

      const listings = await scrapeCrunchbase(
        context,
        config.query,
        config.city,
        config.max_results,
        (found, current) => {
          if (config.onProgress) config.onProgress(found, current)
        },
        cancelToken,
        isSimulate || !context
      )

      for (const item of listings) {
        yield {
          pipeline: 'lead',
          data: {
            business_name: item.business_name,
            description: item.description,
            category: item.category || config.query,
            total_funding_usd: item.total_funding_usd,
            last_funding_type: item.last_funding_type,
            last_funding_amount_usd: item.last_funding_amount_usd,
            last_funding_date: item.last_funding_date,
            lead_investors: item.lead_investors,
            estimated_valuation_usd: item.estimated_valuation_usd,
            headcount_range: item.headcount_range,
            city: item.city || config.city,
            state: item.state,
            country: item.country || config.country,
            website_url: item.website_url,
            crunchbase_url: item.crunchbase_url,
            founders: item.founders,
            growth_rate_pct: item.growth_rate_pct,
            source: 'crunchbase',
          },
        }
      }
    } finally {
      if (context) {
        await context.close().catch(() => {})
      }
    }
  },
}

export default crunchbasePlugin
