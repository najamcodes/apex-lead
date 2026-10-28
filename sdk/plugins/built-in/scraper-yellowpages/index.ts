// plugins/built-in/scraper-yellowpages/index.ts
// LeadHunter Scraper Plugin: YellowPages Business Directory

import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'
import { scrapeYellowPages, type ScrapeControlToken } from './yellowpages'

const ConfigSchema = z.object({
  proxy_url: z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
  simulate: z.boolean().default(false),
})

const yellowPagesPlugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'scraper-yellowpages',
  name: 'YellowPages Scraper',
  version: '1.0.0',
  description: 'Scrapes local businesses, phone numbers, addresses, years in business, and ratings from YellowPages.',
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
        // Fall back gracefully to simulation if browser cannot be launched
        context = null
      }
    }

    try {
      const cancelToken: ScrapeControlToken = {
        get cancelled() { return config.isCancelled ? config.isCancelled() : false },
        paused: false,
      }

      const listings = await scrapeYellowPages(
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
            category: item.category || config.query,
            city: item.city || config.city,
            country: item.country || config.country,
            phone: item.phone,
            address: item.address,
            website_url: item.website_url,
            yellowpages_url: item.yellowpages_url,
            years_in_business: item.years_in_business,
            bbb_rating: item.bbb_rating,
            price_range: item.price_range,
            review_rating: item.rating,
            review_count: item.review_count,
            source: 'yellowpages',
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

export default yellowPagesPlugin
