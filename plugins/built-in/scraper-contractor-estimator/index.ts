// plugins/built-in/scraper-contractor-estimator/index.ts
// LeadHunter Scraper Plugin: Contractor Cost Estimator & Directory Scraper

import { z } from 'zod'
import type { ScraperPlugin, ScraperRunConfig, ScrapedItem } from '../../types'
import { scrapeContractors, type ScrapeControlToken } from './contractor-estimator'

const ConfigSchema = z.object({
  proxy_url: z.string().url().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),
  headful: z.boolean().default(false),
  simulate: z.boolean().default(false),
})

const contractorEstimatorPlugin: ScraperPlugin = {
  kind: 'scraper',
  id: 'scraper-contractor-estimator',
  name: 'Contractor Cost Estimator & Directory Scraper',
  version: '1.0.0',
  description: 'Scrapes trade contractors (Roofing, HVAC, Solar, Plumbing) with job size estimates, license verification, and project price bands.',
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

      const listings = await scrapeContractors(
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
            trade: item.trade,
            category: item.category,
            city: item.city || config.city,
            country: item.country || config.country,
            phone: item.phone,
            email: item.email,
            website_url: item.website_url,
            address: item.address,
            review_rating: item.review_rating,
            review_count: item.review_count,
            licensed: item.licensed,
            insured: item.insured,
            emergency_service_24_7: item.emergency_service_24_7,
            estimated_min_job_cost: item.estimated_min_job_cost,
            estimated_max_job_cost: item.estimated_max_job_cost,
            estimated_avg_job_cost: item.estimated_avg_job_cost,
            cost_metric: item.cost_metric,
            lead_budget_tier: item.lead_budget_tier,
            source: 'contractor_estimator',
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

export default contractorEstimatorPlugin
