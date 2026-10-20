// sdk/backend/nodes/technographic-node.ts
// Detects web technologies, frameworks, CRM, analytics, payments, and infrastructure.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  selectField,
  boolField,
  mainOutput,
  mainInput,
  anySchema,
  getPath,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { detectTechStack } from '@sdk/core/analysis/wappalyzer'

export function registerTechnographicNode() {
  const handler: NodeHandler = {
    type: 'technographic' as any,
    async execute(ctx) {
      const domainField = (ctx.config.domainField as string) || 'domain'
      const websiteField = (ctx.config.websiteField as string) || 'website'
      const targetTechString = (ctx.config.targetTechnologies as string) || ''
      const matchMode = (ctx.config.matchMode as string) || 'any'
      const simulate = Boolean(ctx.config.simulate)

      const targetList = targetTechString
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

      const matchedRecords: PipelineRecord[] = []
      const unmatchedRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const domain = String(
          getPath(domainField, rec.data || {}) ||
            getPath(websiteField, rec.data || {}) ||
            rec.data?.url ||
            ''
        )
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0]

        let techResult = {
          technologies: [] as Array<{ name: string; category: string; version: string | null }>,
          is_mobile_responsive: null as boolean | null,
        }

        if (simulate) {
          // Deterministic simulation for tests / mock pipelines
          const mockTechs = [
            { name: 'Shopify', category: 'E-Commerce', version: '2024' },
            { name: 'Klaviyo', category: 'Marketing Automation', version: null },
            { name: 'Google Analytics', category: 'Analytics', version: 'GA4' },
            { name: 'Stripe', category: 'Payment Processor', version: null },
            { name: 'Tailwind CSS', category: 'CSS Framework', version: '3.4.1' },
          ]
          techResult = {
            technologies: mockTechs,
            is_mobile_responsive: true,
          }
        } else if (domain) {
          try {
            techResult = await detectTechStack(domain)
          } catch (err) {
            ctx.log('warn', `Technographic detection failed for ${domain}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        const techNames = techResult.technologies.map((t) => t.name)
        const techCategories: Record<string, string[]> = {}
        for (const t of techResult.technologies) {
          if (!techCategories[t.category]) techCategories[t.category] = []
          techCategories[t.category].push(t.name)
        }

        // Check target match
        let hasTargetMatch = false
        const matchedTargetTech: string[] = []

        if (targetList.length > 0) {
          const lowerTechs = techNames.map((n) => n.toLowerCase())
          for (const target of targetList) {
            if (lowerTechs.some((t) => t.includes(target))) {
              matchedTargetTech.push(target)
            }
          }
          if (matchMode === 'all') {
            hasTargetMatch = matchedTargetTech.length === targetList.length
          } else {
            hasTargetMatch = matchedTargetTech.length > 0
          }
        }

        const updatedData: Record<string, unknown> = {
          ...rec.data,
          technologies: techNames,
          techCount: techNames.length,
          techCategories,
          hasTargetTech: targetList.length > 0 ? hasTargetMatch : techNames.length > 0,
          matchedTargetTech,
          isMobileResponsive: techResult.is_mobile_responsive,
        }

        const enrichedRec: PipelineRecord = {
          ...rec,
          data: updatedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        allRecords.push(enrichedRec)

        if (hasTargetMatch || (targetList.length === 0 && techNames.length > 0)) {
          matchedRecords.push(enrichedRec)
        } else {
          unmatchedRecords.push(enrichedRec)
        }
      }

      ctx.log(
        'info',
        `[TechnographicNode] Processed ${allRecords.length} records. Matched: ${matchedRecords.length}, Unmatched: ${unmatchedRecords.length}`
      )

      ctx.emit(allRecords, 'main')
      if (matchedRecords.length > 0) {
        ctx.emit(matchedRecords, 'matched')
      }
      if (unmatchedRecords.length > 0) {
        ctx.emit(unmatchedRecords, 'unmatched')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'technographic' as any,
    name: 'Technographic Radar',
    description: 'Detects tech stack, e-commerce platforms, CMS, analytics, CRM, payments, and frameworks used by prospect domains.',
    category: 'Process',
    icon: 'Cpu',
    color: '#8B5CF6',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'matched', label: 'Tech Matched', schema: anySchema },
      { id: 'unmatched', label: 'Tech Unmatched', schema: anySchema },
    ],
    configSchema: {
      domainField: strField('Domain Property', false, 'Property holding company domain or website', 'domain'),
      websiteField: strField('Website Property', false, 'Fallback property holding website URL', 'website'),
      targetTechnologies: strField('Target Technologies', false, 'Comma-separated target tech to filter e.g. "Shopify, Salesforce, HubSpot, Stripe"', ''),
      matchMode: selectField('Match Mode', ['any', 'all'], 'Whether any or all target technologies must match', 'any'),
      simulate: boolField('Simulate (Offline Mode)', 'Emit deterministic mock tech stack for fast local testing', false),
    },
    help: 'Inspects company websites to discover installed technologies.\n\nFilter leads by tech: enter "Shopify, Klaviyo" in Target Technologies and route matching leads via the "Tech Matched" port.',
  })

  registerNode(handler, descriptor)
}
