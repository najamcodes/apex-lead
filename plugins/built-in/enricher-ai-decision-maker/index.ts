import { z } from 'zod'
import type { EnricherPlugin, LeadSnapshot } from '../../types'
import { crawlWebsiteForDecisionMakers } from './website-crawler'
import { extractDecisionMaker } from './extract-decision-maker'
import { getSettings } from '../../../backend/db/queries/settings.queries'

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
    const settings = await getSettings()
    
    if (!settings.ai_enabled || !lead.website_url) {
      return {}
    }

    try {
      const crawlerData = await crawlWebsiteForDecisionMakers(lead.website_url as string)
      const aiDecisionMaker = await extractDecisionMaker(settings, settings.ai_model_site_scoring, crawlerData)
      
      const result: Record<string, unknown> = {}
      if (aiDecisionMaker.contact_name) {
        result.contact_name = aiDecisionMaker.contact_name
      }
      if (aiDecisionMaker.direct_email) {
        result.email = aiDecisionMaker.direct_email
      }
      return result
    } catch (err) {
      console.error('[enricher-ai-decision-maker] Failed:', err)
      return {}
    }
  },
}

export default aiDecisionMakerPlugin
