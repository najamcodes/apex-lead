// sdk/backend/nodes/rfp-estimator-node.ts
// Calculates industrial RFP contract bidding capacity, ISO/ITAR compliance readiness, and procurement tiers.

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, numField, boolField, mainInput, anySchema, getPath } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerRfpEstimatorNode() {
  const handler: NodeHandler = {
    type: 'rfp_estimator',
    async execute(ctx) {
      const primeThreshold = Number(ctx.config.prime_threshold) || 500000
      const subThreshold = Number(ctx.config.sub_threshold) || 100000
      const revField = (ctx.config.revenue_field as string) || 'estimated_annual_revenue'
      const bidRatio = Number(ctx.config.max_single_bid_ratio) || 0.25
      const requireStrictCerts = ctx.config.require_iso_or_itar !== undefined
        ? (ctx.config.require_iso_or_itar === true || ctx.config.require_iso_or_itar === 'true')
        : true

      let primeCount = 0
      let subCount = 0
      let specCount = 0

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const data = rec.data || {}

        // 1. Resolve revenue
        let revenue: number | null = null
        const explicitRev = getPath(revField, data)
        if (typeof explicitRev === 'number' && !isNaN(explicitRev)) {
          revenue = explicitRev
        } else if (typeof explicitRev === 'string') {
          const parsed = parseFloat(explicitRev.replace(/[^0-9.]/g, ''))
          if (!isNaN(parsed)) revenue = parsed
        }

        if (revenue === null) {
          if (typeof data.estimated_annual_revenue === 'number') {
            revenue = data.estimated_annual_revenue
          } else if (typeof data.deal_size === 'number') {
            revenue = data.deal_size * 4
          } else {
            revenue = 5000000 // default baseline $5M revenue
          }
        }

        // 2. Assess certifications & compliance score
        const certs: string[] = Array.isArray(data.certifications) ? data.certifications : []
        const certString = certs.join(' ').toLowerCase()
        const hasStrictCerts =
          certString.includes('iso 9001') ||
          certString.includes('as9100') ||
          certString.includes('itar') ||
          certString.includes('nadcap')

        let complianceScore = 50
        if (hasStrictCerts) complianceScore += 30
        if (data.rfq_enabled) complianceScore += 10
        if (data.website_url) complianceScore += 10

        // 3. Compute bidding capacity
        const estimatedCapacity = Math.round(revenue * bidRatio)

        // 4. Assign procurement tier
        let tier: 'Tier 1 Prime' | 'Tier 2 Subcontractor' | 'Tier 3 Specialist' = 'Tier 3 Specialist'
        if (estimatedCapacity >= primeThreshold && (!requireStrictCerts || hasStrictCerts)) {
          tier = 'Tier 1 Prime'
        } else if (estimatedCapacity >= subThreshold) {
          tier = 'Tier 2 Subcontractor'
        }

        const rfpEstimation = {
          estimated_rfp_capacity: estimatedCapacity,
          annual_revenue_basis: revenue,
          compliance_score: Math.min(complianceScore, 100),
          procurement_tier: tier,
          has_strict_certifications: hasStrictCerts,
          recommended_margin_pct: tier === 'Tier 1 Prime' ? 24 : 18,
          evaluated_at: new Date().toISOString(),
        }

        const enrichedRecord = {
          ...rec,
          data: {
            ...data,
            rfp_estimation: rfpEstimation,
            procurement_tier: tier,
            deal_size: estimatedCapacity,
          },
        }

        if (tier === 'Tier 1 Prime') {
          ctx.emit(enrichedRecord, 'tier_1_prime')
          primeCount++
        } else if (tier === 'Tier 2 Subcontractor') {
          ctx.emit(enrichedRecord, 'tier_2_sub')
          subCount++
        } else {
          ctx.emit(enrichedRecord, 'tier_3_specialist')
          specCount++
        }

        ctx.emit(enrichedRecord, 'main')
      }

      ctx.log(
        'info',
        `RFP estimation completed: ${primeCount} Tier 1 Prime, ${subCount} Tier 2 Sub, ${specCount} Tier 3 Specialist`
      )
    },
  }

  const descriptor = makeDescriptor({
    type: 'rfp_estimator',
    name: 'Industrial RFP & Bidding Estimator',
    description: 'Calculates contract capacity, ISO/ITAR compliance readiness, and routes suppliers to Tier 1 Prime or Subcontractor ports.',
    category: 'Process',
    icon: 'Briefcase',
    color: '#0ea5e9',
    inputs: [mainInput],
    outputs: [
      { id: 'tier_1_prime', label: 'Tier 1 Enterprise Prime ($500k+)', schema: anySchema },
      { id: 'tier_2_sub', label: 'Tier 2 Qualified Subcontractor ($100k-$500k)', schema: anySchema },
      { id: 'tier_3_specialist', label: 'Tier 3 Specialist (<$100k)', schema: anySchema },
      { id: 'main', label: 'All Evaluated Suppliers', schema: anySchema },
    ],
    configSchema: {
      prime_threshold: numField('Prime Contract Threshold ($)', false, 'Min contract capability for Tier 1 Prime', 500000),
      sub_threshold: numField('Subcontractor Threshold ($)', false, 'Min contract capability for Tier 2 Subcontractor', 100000),
      revenue_field: textField('Annual Revenue Field', false, 'Field containing company revenue', 'estimated_annual_revenue'),
      max_single_bid_ratio: numField('Max Single Bid Ratio', false, 'Safe % of annual revenue for single RFP award', 0.25),
      require_iso_or_itar: boolField('Require ISO or ITAR for Primes', 'Enforce ISO 9001/AS9100/ITAR for Tier 1 qualification', true),
    },
    help: 'Evaluates supplier revenue and ISO/AS9100/ITAR compliance to calculate safe bidding capacity for federal, commercial, and industrial RFPs.',
  })

  registerNode(handler, descriptor)
}
