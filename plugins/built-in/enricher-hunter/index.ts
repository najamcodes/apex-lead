// plugins/built-in/enricher-hunter/index.ts
// Wraps src/core/email-finder/hunter.ts + pattern-guesser.ts as an EnricherPlugin.

import { z } from 'zod'
import type { EnricherPlugin, LeadSnapshot, LeadEnrichment } from '../../types'

const ConfigSchema = z.object({
  /** Hunter.io API key. Required for Hunter lookups; pattern-guesser still runs without it. */
  api_key: z.string().optional(),
  /** Also run pattern-guesser as fallback when Hunter finds nothing. */
  pattern_fallback: z.boolean().default(true),
})

function extractDomain(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${url}`)
    return parsed.hostname.replace(/^www\./i, '').toLowerCase().trim()
  } catch {
    return null
  }
}

const hunterPlugin: EnricherPlugin = {
  kind: 'enricher',
  id: 'enricher-hunter',
  name: 'Hunter.io Email Finder',
  version: '1.0.0',
  description: 'Finds professional email addresses via Hunter.io with pattern-guess fallback.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async enrich(lead: LeadSnapshot, rawConfig: Record<string, unknown>): Promise<Partial<LeadEnrichment> | null> {
    // Skip if lead already has a verified email
    if (lead.email && lead.email_verified) return null

    const config = ConfigSchema.parse(rawConfig)
    const domain = extractDomain(lead.website_url)
    if (!domain) return null

    const { findEmailWithHunter } = await import('./hunter')
    const { guessEmailFromDomain } = await import('./pattern-guesser')

    // Try Hunter.io first (only if API key is configured)
    let foundEmail: string | null = null
    if (config.api_key) {
      foundEmail = await findEmailWithHunter(domain, config.api_key).catch(() => null)
    }

    // Fallback to pattern guesser
    if (!foundEmail && config.pattern_fallback) {
      foundEmail = await guessEmailFromDomain(domain).catch(() => null)
    }

    if (!foundEmail) return null

    return {
      email: foundEmail,
      email_verified: false,   // Verification is a separate step
    }
  },
}

export default hunterPlugin
