// sdk/backend/nodes/funding-intent-node.ts
// Evaluates venture funding capital deployment timelines, estimated tool/agency budgets, and buying urgency.

import { registerNode } from '../engine/registry'
import { makeDescriptor, numField, mainInput, anySchema } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerFundingIntentNode() {
  const handler: NodeHandler = {
    type: 'funding_intent',
    async execute(ctx) {
      const minFunding = Number(ctx.config.min_funding_threshold) || 5000000
      const budgetPct = Number(ctx.config.budget_allocation_pct) || 10
      const immediateDays = Number(ctx.config.freshness_days_immediate) || 180

      let immediateCount = 0
      let growthCount = 0
      let matureCount = 0

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const data = rec.data || {}

        // 1. Resolve funding amounts
        const lastAmount =
          typeof data.last_funding_amount_usd === 'number'
            ? data.last_funding_amount_usd
            : typeof data.total_funding_usd === 'number'
              ? data.total_funding_usd
              : 10000000

        const totalFunding =
          typeof data.total_funding_usd === 'number'
            ? data.total_funding_usd
            : lastAmount

        // 2. Resolve funding date and freshness
        let daysAgo = 90
        if (typeof data.last_funding_date === 'string') {
          const parsed = Date.parse(data.last_funding_date)
          if (!isNaN(parsed)) {
            daysAgo = Math.max(0, Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000)))
          }
        }

        // 3. Compute estimated budget and urgency
        const estimatedBudget = Math.round(lastAmount * (budgetPct / 100))
        let urgencyScore = Math.max(20, Math.min(100, Math.round(100 - daysAgo * 0.3)))
        if (totalFunding >= 25000000) urgencyScore = Math.min(100, urgencyScore + 15)

        let deploymentStatus: 'Immediate Expansion' | 'Active Growth Scale' | 'Mature Nurture' = 'Mature Nurture'
        if (daysAgo <= immediateDays && totalFunding >= minFunding) {
          deploymentStatus = 'Immediate Expansion'
        } else if (daysAgo <= 540) {
          deploymentStatus = 'Active Growth Scale'
        }

        const fundingIntent = {
          deployment_status: deploymentStatus,
          estimated_software_agency_budget: estimatedBudget,
          days_since_funding: daysAgo,
          capital_urgency_score: urgencyScore,
          target_executive_personas: ['VP of Engineering', 'Head of Growth', 'Chief Revenue Officer'],
          calculated_at: new Date().toISOString(),
        }

        const enrichedRecord = {
          ...rec,
          data: {
            ...data,
            funding_intent: fundingIntent,
            capital_deployment_status: deploymentStatus,
            deal_size: estimatedBudget,
          },
        }

        if (deploymentStatus === 'Immediate Expansion') {
          ctx.emit(enrichedRecord, 'immediate_expansion')
          immediateCount++
        } else if (deploymentStatus === 'Active Growth Scale') {
          ctx.emit(enrichedRecord, 'growth_scale')
          growthCount++
        } else {
          ctx.emit(enrichedRecord, 'mature_nurture')
          matureCount++
        }

        ctx.emit(enrichedRecord, 'main')
      }

      ctx.log(
        'info',
        `Funding intent evaluation completed: ${immediateCount} Immediate, ${growthCount} Growth, ${matureCount} Mature`
      )
    },
  }

  const descriptor = makeDescriptor({
    type: 'funding_intent',
    name: 'Venture Funding & Intent Qualifier',
    description: 'Calculates fresh capital deployment runway, estimated enterprise software/agency budgets, and routes by buying urgency.',
    category: 'Process',
    icon: 'TrendingUp',
    color: '#f59e0b',
    inputs: [mainInput],
    outputs: [
      { id: 'immediate_expansion', label: 'Immediate Expansion (Fresh Capital <6mo)', schema: anySchema },
      { id: 'growth_scale', label: 'Active Growth Scale (6-18mo)', schema: anySchema },
      { id: 'mature_nurture', label: 'Mature / Next Round (>18mo)', schema: anySchema },
      { id: 'main', label: 'All Evaluated Companies', schema: anySchema },
    ],
    configSchema: {
      min_funding_threshold: numField('Minimum Funding ($)', false, 'Min total funding for high-intent qualification', 5000000),
      budget_allocation_pct: numField('Estimated Tech/Software Budget (%)', false, 'Percentage of new round deployed for software & agency services', 10),
      freshness_days_immediate: numField('Fresh Round Days (Immediate)', false, 'Days since funding for immediate outreach trigger', 180),
    },
    help: 'Analyzes funding rounds, recency, and capital size to determine when companies are actively hiring and procuring enterprise tools and vendor services.',
  })

  registerNode(handler, descriptor)
}
