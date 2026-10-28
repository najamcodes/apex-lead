// plugins/built-in/enricher-pagespeed/index.ts
// Wraps src/core/analysis/pagespeed.ts as an EnricherPlugin.

import { z } from 'zod'
import type { EnricherPlugin, LeadSnapshot, LeadEnrichment } from '../../types'

const ConfigSchema = z.object({
  /** Google PageSpeed Insights API key (optional — 25 req/day free without key). */
  api_key: z.string().optional(),
})

const pagespeedPlugin: EnricherPlugin = {
  kind: 'enricher',
  id: 'enricher-pagespeed',
  name: 'PageSpeed Enricher',
  version: '1.0.0',
  description: 'Audits lead websites using Google PageSpeed Insights API.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async enrich(lead: LeadSnapshot, config: Record<string, unknown>): Promise<Partial<LeadEnrichment> | null> {
    if (!lead.website_url) return null

    const { api_key } = ConfigSchema.parse(config)
    const { runPageSpeed } = await import('./pagespeed')

    try {
      const result = await runPageSpeed(lead.website_url, api_key ?? '')
      if (!result) return null

      return {
        pagespeed_mobile:  result.mobile_score,
        pagespeed_desktop: result.desktop_score,
        seo_metrics:       result.seo_metrics,
      }
    } catch {
      return null
    }
  },
}

export default pagespeedPlugin
