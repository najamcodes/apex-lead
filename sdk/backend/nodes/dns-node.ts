// backend/nodes/dns-node.ts
// Validates MX records, SPF, and DMARC for email addresses/domains and routes to 'deliverable' or 'risky'

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, numField, mainInput, anySchema, getPath } from './descriptors'
import { checkDomainDeliverability } from '../../../plugins/built-in/enricher-dns-deliverability/dns-checker'
import type { NodeHandler } from '../engine/types'

export function registerDnsNode() {
  const handler: NodeHandler = {
    type: 'dns_check',
    async execute(ctx) {
      const field = (ctx.config.field as string) || 'email'
      const minScore = Number(ctx.config.min_score) || 60
      const simulate = Boolean(ctx.config.simulate)

      let deliverableCount = 0
      let riskyCount = 0

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const target = (getPath(field, rec.data) || rec.data.email || rec.data.website_url || '') as string
        if (!target) {
          ctx.emit(rec, 'risky')
          riskyCount++
          continue
        }

        try {
          const res = await checkDomainDeliverability(target, simulate)
          const enrichedData = {
            ...rec.data,
            dns_deliverability: {
              score: res.deliverability_score,
              provider: res.mail_provider,
              has_mx: res.has_mx,
              has_spf: res.has_spf,
              has_dmarc: res.has_dmarc,
              mx_records: res.mx_records,
            },
            email_verified: res.has_mx && res.deliverability_score >= minScore,
          }

          if (res.has_mx && res.deliverability_score >= minScore) {
            ctx.emit({ ...rec, data: enrichedData }, 'deliverable')
            deliverableCount++
          } else {
            ctx.emit({ ...rec, data: enrichedData }, 'risky')
            riskyCount++
          }
        } catch (err: any) {
          ctx.log('error', `DNS check failed for ${target}: ${err?.message || err}`)
          ctx.emit(rec, 'risky')
          riskyCount++
        }
      }

      ctx.log('info', `DNS deliverability check complete: ${deliverableCount} deliverable, ${riskyCount} risky`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'dns_check',
    name: 'DNS & Deliverability Check',
    description: 'Inspects MX records, SPF, and DMARC policies for lead domains and routes records by deliverability.',
    category: 'Process',
    icon: 'ShieldCheck',
    color: '#06b6d4',
    inputs: [mainInput],
    outputs: [
      { id: 'deliverable', label: 'Deliverable', schema: anySchema },
      { id: 'risky', label: 'Risky / Invalid', schema: anySchema },
    ],
    configSchema: {
      field: textField('Target Field', false, 'Path to email address or domain (defaults to email or website_url)', 'email'),
      min_score: numField('Minimum Score', false, 'Threshold score (0-100) to classify as deliverable', 60),
    },
    help: 'Evaluates MX records, SPF, and DMARC. Emits healthy records to "deliverable" and missing/failed mail servers to "risky".',
  })

  registerNode(handler, descriptor)
}
