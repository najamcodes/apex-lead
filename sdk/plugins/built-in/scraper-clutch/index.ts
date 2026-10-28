// plugins/built-in/scraper-clutch/index.ts
// LeadHunter Scraper Plugin: Clutch B2B Directory (Min Project Size, Hourly Rates, Reviews)

import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'
import { scrapeClutch, type ScrapeControlToken } from './clutch'

const ConfigSchema = z.object({
  proxy_url: z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
  simulate: z.boolean().default(false),
})

const clutchPlugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'scraper-clutch',
  name: 'Clutch B2B Agency Scraper',
  version: '1.0.0',
  description: 'Scrapes B2B agencies, software firms, minimum project sizes, hourly rates, and verified reviews from Clutch.co.',
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

      const listings = await scrapeClutch(
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
            tagline: item.tagline,
            category: item.category || config.query,
            city: item.city || config.city,
            country: item.country || config.country,
            phone: item.phone,
            website_url: item.website_url,
            min_project_size: item.min_project_size,
            min_project_size_label: item.min_project_size_label,
            avg_hourly_rate: item.avg_hourly_rate,
            hourly_rate_label: item.hourly_rate_label,
            team_size: item.team_size,
            review_rating: item.review_rating,
            review_count: item.review_count,
            verification_status: item.verification_status,
            clutch_url: item.clutch_url,
            source: 'clutch',
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

export default clutchPlugin
