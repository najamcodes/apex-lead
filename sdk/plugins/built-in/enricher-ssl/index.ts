// plugins/built-in/enricher-ssl/index.ts
// Wraps ssl-checker.ts + wappalyzer.ts + linkedin-dork.ts as a single EnricherPlugin.

import { z } from 'zod'
import type { EnricherPlugin, LeadSnapshot, LeadEnrichment } from '../../types'

const ConfigSchema = z.object({
  /** Enable Wappalyzer tech stack detection (slightly slower). */
  wappalyzer_enabled: z.boolean().default(true),
  /** Enable LinkedIn dorking for contact name discovery. */
  linkedin_dork_enabled: z.boolean().default(true),
})

const sslPlugin: EnricherPlugin = {
  kind: 'enricher',
  id: 'enricher-ssl',
  name: 'SSL & Tech Stack Enricher',
  version: '1.0.0',
  description: 'Checks SSL, detects tech stack, estimates build year, and extracts social links.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async enrich(lead: LeadSnapshot, rawConfig: Record<string, unknown>): Promise<Partial<LeadEnrichment> | null> {
    if (!lead.website_url) return null

    const config = ConfigSchema.parse(rawConfig)
    const { checkSsl, estimateBuildYear } = await import('./ssl-checker')
    const { detectTechStack } = await import('./wappalyzer')
    const { searchLinkedInForOwner } = await import('./linkedin-dork')

    const [sslResult, wapResult, dorkResult] = await Promise.allSettled([
      checkSsl(lead.website_url),
      config.wappalyzer_enabled ? detectTechStack(lead.website_url) : Promise.resolve(null),
      config.linkedin_dork_enabled ? searchLinkedInForOwner(lead.business_name, lead.city) : Promise.resolve(null),
    ])

    const ssl   = sslResult.status  === 'fulfilled' ? sslResult.value  : null
    const wap   = wapResult.status  === 'fulfilled' ? wapResult.value  : null
    const dork  = dorkResult.status === 'fulfilled' ? dorkResult.value : null

    // Merge social links
    const socialLinksObj: Record<string, string> = {}
    if (ssl?.social_links) Object.assign(socialLinksObj, ssl.social_links)
    if (dork?.linkedin_url) socialLinksObj.linkedin = dork.linkedin_url

    return {
      ssl_valid:      ssl ? ssl.ssl_valid : null,
      site_built_year: ssl ? estimateBuildYear(ssl.last_modified) : null,
      tech_stack:     wap ? JSON.stringify(wap.technologies.map(t => t.name)) : null,
      social_links:   Object.keys(socialLinksObj).length > 0 ? JSON.stringify(socialLinksObj) : null,
      contact_name:   dork?.contact_name ?? null,
    }
  },
}

export default sslPlugin
