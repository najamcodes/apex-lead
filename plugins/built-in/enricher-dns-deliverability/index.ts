import { z } from 'zod'
import type { EnricherPlugin, LeadSnapshot, LeadEnrichment } from '../../types'

const ConfigSchema = z.object({
  min_deliverability_score: z.number().min(0).max(100).default(65),
})

const dnsDeliverabilityPlugin: EnricherPlugin = {
  kind: 'enricher',
  id: 'enricher-dns-deliverability',
  name: 'DNS & MX Deliverability Checker',
  version: '1.0.0',
  description: 'Validates domain MX records, identifies mail providers (Google, Microsoft), checks SPF & DMARC compliance, and evaluates inbox deliverability health.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  async enrich(lead: LeadSnapshot, rawConfig: Record<string, unknown>): Promise<Partial<LeadEnrichment> | null> {
    const target = lead.email || lead.website_url
    if (!target) return null

    const config = ConfigSchema.parse(rawConfig || {})
    const { checkDomainDeliverability } = await import('./dns-checker')
    const result = await checkDomainDeliverability(target)

    const isVerified = result.has_mx && result.deliverability_score >= config.min_deliverability_score

    // Merge or preserve existing SEO / technical metrics
    let existingMetrics: Record<string, any> = {}
    if ((lead as any).seo_metrics) {
      try { existingMetrics = JSON.parse((lead as any).seo_metrics) } catch {}
    }

    const updatedMetrics = {
      ...existingMetrics,
      deliverability: {
        score: result.deliverability_score,
        provider: result.mail_provider,
        has_mx: result.has_mx,
        has_spf: result.has_spf,
        has_dmarc: result.has_dmarc,
        mx_records: result.mx_records.slice(0, 3),
      },
    }

    return {
      email_verified: isVerified,
      seo_metrics: JSON.stringify(updatedMetrics),
    }
  },
}

export default dnsDeliverabilityPlugin
