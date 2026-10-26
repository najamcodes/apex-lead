// sdk/backend/nodes/cost-estimator-node.ts
// Calculates estimated project size, annual customer LTV, and routes leads by budget tier (High Ticket, Mid-Market, SMB).

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, numField, mainInput, anySchema, getPath } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerCostEstimatorNode() {
  const handler: NodeHandler = {
    type: 'cost_estimator',
    async execute(ctx) {
      const highThreshold = Number(ctx.config.high_ticket_threshold) || 25000
      const midThreshold = Number(ctx.config.mid_market_threshold) || 5000
      const field = (ctx.config.project_size_field as string) || 'estimated_avg_job_cost'
      const tradeMultiplier = Number(ctx.config.trade_multiplier) || 1.0
      const ltvMultiplier = Number(ctx.config.annual_ltv_multiplier) || 1.5

      let highCount = 0
      let midCount = 0
      let smbCount = 0

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const data = rec.data || {}

        // Resolve raw base value
        let rawVal: number | null = null
        const explicitVal = getPath(field, data)
        if (typeof explicitVal === 'number' && !isNaN(explicitVal)) {
          rawVal = explicitVal
        } else if (typeof explicitVal === 'string') {
          const parsed = parseFloat(explicitVal.replace(/[^0-9.]/g, ''))
          if (!isNaN(parsed)) rawVal = parsed
        }

        // Fallbacks if explicit field is missing
        if (rawVal === null) {
          if (typeof data.estimated_avg_job_cost === 'number') {
            rawVal = data.estimated_avg_job_cost
          } else if (typeof data.min_project_size === 'number') {
            rawVal = data.min_project_size
          } else if (typeof data.avg_hourly_rate === 'number') {
            // Assume typical agency / consultancy 80-hour project
            rawVal = data.avg_hourly_rate * 80
          } else if (data.price_range === '$$$$') {
            rawVal = 35000
          } else if (data.price_range === '$$$') {
            rawVal = 15000
          } else if (data.price_range === '$$') {
            rawVal = 5000
          } else if (data.price_range === '$') {
            rawVal = 1500
          } else {
            rawVal = 3000 // default SMB baseline
          }
        }

        const estimatedJobValue = Math.round(rawVal * tradeMultiplier)
        const estimatedAnnualLtv = Math.round(estimatedJobValue * ltvMultiplier)

        let budgetTier: 'High Ticket' | 'Mid-Market' | 'SMB' = 'SMB'
        if (estimatedJobValue >= highThreshold) {
          budgetTier = 'High Ticket'
        } else if (estimatedJobValue >= midThreshold) {
          budgetTier = 'Mid-Market'
        }

        // Calculate confidence score (0-100) based on signal completeness
        let confidence = 50
        if (explicitVal !== undefined && explicitVal !== null) confidence += 20
        if (data.review_count && Number(data.review_count) > 10) confidence += 10
        if (data.licensed || data.verification_status === 'Verified') confidence += 10
        if (data.website_url) confidence += 10

        const costEstimation = {
          estimated_job_value: estimatedJobValue,
          estimated_annual_ltv: estimatedAnnualLtv,
          budget_tier: budgetTier,
          confidence_score: Math.min(confidence, 100),
          currency: 'USD',
          calculated_at: new Date().toISOString(),
        }

        const enrichedData = {
          ...data,
          cost_estimation: costEstimation,
          lead_budget_tier: budgetTier,
          deal_size: estimatedJobValue,
        }

        const enrichedRec = {
          ...rec,
          data: enrichedData,
        }

        if (budgetTier === 'High Ticket') {
          ctx.emit(enrichedRec, 'high_ticket')
          highCount++
        } else if (budgetTier === 'Mid-Market') {
          ctx.emit(enrichedRec, 'mid_market')
          midCount++
        } else {
          ctx.emit(enrichedRec, 'smb')
          smbCount++
        }

        // Also emit to main so all records flow downstream together
        ctx.emit(enrichedRec, 'main')
      }

      ctx.log(
        'info',
        `Cost estimation completed: ${highCount} High Ticket, ${midCount} Mid-Market, ${smbCount} SMB`
      )
    },
  }

  const descriptor = makeDescriptor({
    type: 'cost_estimator',
    name: 'Cost Estimator & Deal Size Qualifier',
    description: 'Calculates job size values, estimated annual LTV, and routes leads to High Ticket, Mid-Market, or SMB tiers.',
    category: 'Process',
    icon: 'Calculator',
    color: '#10b981',
    inputs: [mainInput],
    outputs: [
      { id: 'high_ticket', label: 'High Ticket (Enterprise/Major)', schema: anySchema },
      { id: 'mid_market', label: 'Mid-Market', schema: anySchema },
      { id: 'smb', label: 'SMB / Standard', schema: anySchema },
      { id: 'main', label: 'All Enriched Records', schema: anySchema },
    ],
    configSchema: {
      high_ticket_threshold: numField('High Ticket Threshold ($)', false, 'Min estimated value for High Ticket branch', 25000),
      mid_market_threshold: numField('Mid-Market Threshold ($)', false, 'Min estimated value for Mid-Market branch', 5000),
      project_size_field: textField('Project Size / Price Field', false, 'Field path containing project size or revenue', 'estimated_avg_job_cost'),
      trade_multiplier: numField('Industry / Trade Multiplier', false, 'Multiplier applied to baseline estimate', 1.0),
      annual_ltv_multiplier: numField('Annual Repeat / LTV Factor', false, 'Multiplier for recurring/LTV lifetime value calculation', 1.5),
    },
    help: 'Calculates project size values and customer LTV. Routes records to high_ticket, mid_market, and smb ports while passing all records through main.',
  })

  registerNode(handler, descriptor)
}
