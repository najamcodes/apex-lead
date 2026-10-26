import { z } from 'zod'
import type { EnricherPlugin, LeadSnapshot } from '../../types'

const ConfigSchema = z.object({})

const aiDecisionMakerPlugin: EnricherPlugin = {
  kind: 'enricher',
  id: 'enricher-ai-decision-maker',
  name: 'AI Decision Maker Finder',
  version: '1.0.0',
  description: 'Crawls the prospect website and uses AI to identify the primary decision maker and their direct email.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async enrich(lead: LeadSnapshot): Promise<Record<string, unknown>> {
    if (!lead.website_url) {
      return {}
    }

    try {
      const { getSettings } = await import('../../../backend/db/queries/settings.queries')
      const settings = await getSettings().catch(() => ({} as any))
      
      if (!settings?.ai_enabled) {
        return {}
      }

      const { crawlWebsiteForDecisionMakers } = await import('./website-crawler')
      const { extractDecisionMaker } = await import('./extract-decision-maker')
      const crawlerData = await crawlWebsiteForDecisionMakers(lead.website_url as string)
      const aiDecisionMaker = await extractDecisionMaker(settings, settings.ai_model_site_scoring || 'gpt-4o-mini', crawlerData)
      
      const result: Record<string, unknown> = {}
      if (aiDecisionMaker.contact_name) {
        result.contact_name = aiDecisionMaker.contact_name
      }
      if (aiDecisionMaker.direct_email) {
        result.email = aiDecisionMaker.direct_email
      }
      if (aiDecisionMaker.role) {
        result.contact_role = aiDecisionMaker.role
        result.role = aiDecisionMaker.role
      }
      return result
    } catch (err) {
      console.error('[enricher-ai-decision-maker] Failed:', err)
      return {}
    }
  },
}

export default aiDecisionMakerPlugin
