// plugins/built-in/scraper-google-maps/index.ts
import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'

const ConfigSchema = z.object({
  proxy_url:      z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
})

const googleMapsPlugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'google-maps',
  name: 'Google Maps Scraper',
  version: '1.0.0',
  description: 'Scrapes business listings from Google Maps using stealth Playwright.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async *scrape(config: ScraperRunConfig): AsyncGenerator<ScrapedItem> {
    const { createStealthContext } = await import('@sdk/core/scraper/stealth')
    const { scrapeGoogleMaps } = await import('./google-maps')

    const pluginCfg = ConfigSchema.parse(config.pluginConfig)
    const proxyConfig = pluginCfg.proxy_url
      ? {
          server:   pluginCfg.proxy_url,
          username: pluginCfg.proxy_username,
          password: pluginCfg.proxy_password,
        }
      : null

    const { context } = await createStealthContext(proxyConfig, !pluginCfg.headful)

    try {
      const cancelToken = { 
        get cancelled() { return config.isCancelled ? config.isCancelled() : false }, 
        paused: false 
      }

      const listings = await scrapeGoogleMaps(
        context,
        config.query,
        config.city,
        config.max_results,
        (found, current) => {
          if (config.onProgress) config.onProgress(found, current)
        },
        cancelToken as any
      )

      for (const listing of listings) {
        yield { pipeline: 'lead', data: {
          business_name:  listing.business_name,
          category:       listing.category,
          city:           listing.city,
          country:        config.country,
          phone:          listing.phone ?? null,
          email:          listing.email ?? null,
          website_url:    listing.website_url ?? null,
          google_maps_url: listing.google_maps_url ?? null,
          review_rating:  listing.rating ?? null,
          review_count:   listing.review_count ?? null,
          source:         'google_maps',
        }}
      }
    } finally {
      await context.close().catch(() => {})
    }
  },
}

export default googleMapsPlugin

