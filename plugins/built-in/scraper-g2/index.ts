// plugins/built-in/scraper-g2/index.ts
// LeadHunter Scraper Plugin: G2 Software & Tech Vendors

import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'
import { scrapeG2, type ScrapeControlToken } from './g2'

const ConfigSchema = z.object({
  proxy_url: z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
  simulate: z.boolean().default(false),
})

const g2Plugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'scraper-g2',
  name: 'G2 Software & Tech Vendor Scraper',
  version: '1.0.0',
  description: 'Scrapes B2B software vendors, G2 Grid rankings, enterprise pricing estimates, review sentiment, and competitor lists from G2.',
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

      const listings = await scrapeG2(
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
            product_name: item.product_name,
            tagline: item.tagline,
            category: item.category || config.query,
            g2_rating: item.g2_rating,
            g2_reviews_count: item.g2_reviews_count,
            g2_grid_quadrant: item.g2_grid_quadrant,
            pricing_model: item.pricing_model,
            starting_price_usd: item.starting_price_usd,
            estimated_enterprise_deal_usd: item.estimated_enterprise_deal_usd,
            key_competitors: item.key_competitors,
            website_url: item.website_url,
            g2_url: item.g2_url,
            source: 'g2',
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

export default g2Plugin
