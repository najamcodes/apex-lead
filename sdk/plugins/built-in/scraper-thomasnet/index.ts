// plugins/built-in/scraper-thomasnet/index.ts
// LeadHunter Scraper Plugin: ThomasNet Industrial & Manufacturing Suppliers

import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'
import { scrapeThomasNet, type ScrapeControlToken } from './thomasnet'

const ConfigSchema = z.object({
  proxy_url: z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
  simulate: z.boolean().default(false),
})

const thomasNetPlugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'scraper-thomasnet',
  name: 'ThomasNet Industrial & Manufacturing Scraper',
  version: '1.0.0',
  description: 'Scrapes North American manufacturers, suppliers, CNC machine shops, ISO certifications, and annual revenue estimates from ThomasNet.',
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

      const listings = await scrapeThomasNet(
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
            primary_company_type: item.primary_company_type,
            annual_revenue_range: item.annual_revenue_range,
            estimated_annual_revenue: item.estimated_annual_revenue,
            employee_count_range: item.employee_count_range,
            year_founded: item.year_founded,
            certifications: item.certifications,
            capabilities: item.capabilities,
            city: item.city || config.city,
            state: item.state,
            country: item.country || config.country,
            phone: item.phone,
            email: item.email,
            website_url: item.website_url,
            address: item.address,
            rfq_enabled: item.rfq_enabled,
            thomasnet_url: item.thomasnet_url,
            source: 'thomasnet',
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

export default thomasNetPlugin
