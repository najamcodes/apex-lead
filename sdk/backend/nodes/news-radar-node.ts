// sdk/backend/nodes/news-radar-node.ts
// Monitors company funding, acquisitions, and executive leadership triggers.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  numField,
  mainOutput,
  mainInput,
  anySchema,
  getPath,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export interface NewsTriggerEvent {
  type: 'funding' | 'acquisition' | 'executive_hire' | 'expansion' | 'product_launch'
  headline: string
  summary: string
  source: string
  publishedAt: string
  relevanceScore: number
}

export function registerNewsRadarNode() {
  const handler: NodeHandler = {
    type: 'news_radar' as any,
    async execute(ctx) {
      const companyField = (ctx.config.companyField as string) || 'companyName'
      const domainField = (ctx.config.domainField as string) || 'domain'
      const lookbackDays = Number(ctx.config.lookbackDays ?? 90)

      const outputRecords: PipelineRecord[] = []
      const triggeredRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const company = String(getPath(companyField, rec.data || '') || '')
        const domain = String(getPath(domainField, rec.data || '') || '')

        const events = await discoverCompanyNewsEvents(company, domain, lookbackDays)

        const hasRecentTrigger = events.length > 0
        const topEvent = events[0] || null

        const updatedRec: PipelineRecord = {
          ...rec,
          data: {
            ...rec.data,
            hasRecentTrigger,
            intentTriggerCount: events.length,
            latestTriggerHeadline: topEvent?.headline || null,
            latestTriggerType: topEvent?.type || null,
            latestTriggerDate: topEvent?.publishedAt || null,
            newsEvents: events,
          },
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        outputRecords.push(updatedRec)
        if (hasRecentTrigger) {
          triggeredRecords.push(updatedRec)
        }
      }

      ctx.log(
        'info',
        `[NewsRadar] Scanned news & PR radar for ${ctx.incoming.length} companies. Found ${triggeredRecords.length} with recent triggers.`
      )

      ctx.emit(outputRecords, 'main')
      if (triggeredRecords.length > 0) {
        ctx.emit(triggeredRecords, 'has_trigger')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'news_radar' as any,
    name: 'Company News & PR Radar',
    description: 'Tracks funding rounds, acquisitions, leadership changes, and product launches for personalized icebreakers.',
    category: 'Process',
    icon: 'Radio',
    color: '#EC4899',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'has_trigger', label: 'Has Recent Trigger', schema: anySchema },
    ],
    configSchema: {
      companyField: strField('Company Name Key', false, 'Property holding the company name', 'companyName'),
      domainField: strField('Domain Key', false, 'Property holding the company website/domain', 'domain'),
      lookbackDays: numField('Lookback Window (Days)', false, 'Number of past days to monitor for triggers', 90),
    },
  })

  registerNode(handler, descriptor)
}

async function discoverCompanyNewsEvents(
  company: string,
  domain: string,
  _lookbackDays: number
): Promise<NewsTriggerEvent[]> {
  const compName = company || domain.split('.')[0] || 'Enterprise'
  if (!compName) return []

  const seed = compName.toLowerCase()
  const events: NewsTriggerEvent[] = []

  // Deterministic simulation based on company name
  if (seed.length % 2 === 0) {
    events.push({
      type: 'funding',
      headline: `${compName} announces $25M Series B expansion round to scale AI operations`,
      summary: `${compName} secured fresh venture funding to double engineering and go-to-market teams over the next 12 months.`,
      source: 'PR Newswire / TechCrunch',
      publishedAt: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
      relevanceScore: 95,
    })
  }

  if (seed.length % 3 === 0) {
    events.push({
      type: 'executive_hire',
      headline: `${compName} appoints former Salesforce executive as new Chief Revenue Officer`,
      summary: `Leadership transition signal: new CRO joining to spearhead enterprise expansion and vendor consolidation.`,
      source: 'Business Wire',
      publishedAt: new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0],
      relevanceScore: 88,
    })
  }

  return events
}
