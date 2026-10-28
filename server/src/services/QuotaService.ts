import { getDataSource } from '../db'
import { OrganizationEntity, OrgTier } from '../db/entities/OrganizationEntity'
import { OrganizationUsageEntity } from '../db/entities/OrganizationUsageEntity'

export interface TierEntitlements {
  leads: number
  cloudScrapes: number
  waterfall: number
  aiCalls: number
  seats: number
  allowCloudScraper: boolean
}

export const TIER_LIMITS: Record<string, TierEntitlements> = {
  free: {
    leads: 50,
    cloudScrapes: 0,
    waterfall: 25,
    aiCalls: 25,
    seats: 1,
    allowCloudScraper: false,
  },
  starter: {
    leads: 1500,
    cloudScrapes: 0,
    waterfall: 500,
    aiCalls: 500,
    seats: 2,
    allowCloudScraper: false,
  },
  pro: {
    leads: 7500,
    cloudScrapes: 100,
    waterfall: 3000,
    aiCalls: 2500,
    seats: 5,
    allowCloudScraper: true,
  },
  agency: {
    leads: 25000,
    cloudScrapes: 500,
    waterfall: 15000,
    aiCalls: 10000,
    seats: 15,
    allowCloudScraper: true,
  },
  enterprise: {
    leads: 25000,
    cloudScrapes: 500,
    waterfall: 15000,
    aiCalls: 10000,
    seats: 15,
    allowCloudScraper: true,
  },
}

export type QuotaFeature = 'leads' | 'cloudScrapes' | 'waterfall' | 'aiCalls'

export class QuotaService {
  private currentPeriod(): string {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  async checkQuota(
    orgId: number,
    feature: QuotaFeature,
    quantity = 1
  ): Promise<{ allowed: boolean; remaining: number; limit: number; currentUsage: number }> {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)
    const usageRepo = ds.getRepository(OrganizationUsageEntity)

    const org = await orgRepo.findOneBy({ id: orgId })
    const tier = (org?.tier || 'free').toLowerCase()
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free

    // Feature gating check (Cloud Playwright vs Local Desktop)
    if (feature === 'cloudScrapes' && !limits.allowCloudScraper) {
      return { allowed: false, remaining: 0, limit: 0, currentUsage: 0 }
    }

    const period = this.currentPeriod()
    let usage = await usageRepo.findOneBy({ org_id: orgId, billing_period: period })
    if (!usage) {
      try {
        usage = usageRepo.create({
          org_id: orgId,
          billing_period: period,
          leads_exported: 0,
          cloud_scrapes_executed: 0,
          waterfall_checks_used: 0,
          ai_tokens_used: 0,
        })
        usage = await usageRepo.save(usage)
      } catch {
        // Handle concurrent insert race safely
        usage = (await usageRepo.findOneBy({ org_id: orgId, billing_period: period })) || usage
      }
    }

    const currentUsageMap = {
      leads: usage?.leads_exported || 0,
      cloudScrapes: usage?.cloud_scrapes_executed || 0,
      waterfall: usage?.waterfall_checks_used || 0,
      aiCalls: usage?.ai_tokens_used || 0,
    }

    const currentUsage = currentUsageMap[feature]
    const limit = limits[feature]
    const remaining = Math.max(0, limit - currentUsage)

    return {
      allowed: currentUsage + quantity <= limit,
      remaining,
      limit,
      currentUsage,
    }
  }

  async consumeQuota(orgId: number, feature: QuotaFeature, quantity = 1): Promise<void> {
    const ds = getDataSource()
    const usageRepo = ds.getRepository(OrganizationUsageEntity)
    const period = this.currentPeriod()

    // Ensure usage row exists
    let usage = await usageRepo.findOneBy({ org_id: orgId, billing_period: period })
    if (!usage) {
      try {
        usage = usageRepo.create({
          org_id: orgId,
          billing_period: period,
          leads_exported: 0,
          cloud_scrapes_executed: 0,
          waterfall_checks_used: 0,
          ai_tokens_used: 0,
        })
        await usageRepo.save(usage)
      } catch {
        // Race condition safe
      }
    }

    const fieldMap: Record<QuotaFeature, keyof OrganizationUsageEntity> = {
      leads: 'leads_exported',
      cloudScrapes: 'cloud_scrapes_executed',
      waterfall: 'waterfall_checks_used',
      aiCalls: 'ai_tokens_used',
    }
    const updateField = fieldMap[feature]

    await usageRepo
      .createQueryBuilder()
      .update(OrganizationUsageEntity)
      .set({
        [updateField]: () => `${String(updateField)} + ${quantity}`,
      } as unknown as import('typeorm').QueryDeepPartialEntity<OrganizationUsageEntity>)
      .where('org_id = :orgId AND billing_period = :period', { orgId, period })
      .execute()
  }

  async assertQuotaAvailable(orgId: number, feature: QuotaFeature, quantity = 1): Promise<void> {
    const result = await this.checkQuota(orgId, feature, quantity)
    if (!result.allowed) {
      throw new Error(`Quota exceeded for ${feature}. Limit: ${result.limit}, Used: ${result.currentUsage}`)
    }
  }

  async incrementUsage(orgId: number, feature: QuotaFeature, quantity = 1): Promise<void> {
    await this.consumeQuota(orgId, feature, quantity)
  }

  async getUsageAndLimits(orgId: number) {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)
    const usageRepo = ds.getRepository(OrganizationUsageEntity)

    const org = await orgRepo.findOneBy({ id: orgId })
    const tier = (org?.tier || 'free').toLowerCase()
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free
    const period = this.currentPeriod()

    const usage = await usageRepo.findOneBy({ org_id: orgId, billing_period: period })

    return {
      tier,
      billingPeriod: period,
      billingEmail: org?.billing_email || null,
      limits,
      usage: {
        leads: usage?.leads_exported || 0,
        cloudScrapes: usage?.cloud_scrapes_executed || 0,
        waterfall: usage?.waterfall_checks_used || 0,
        aiCalls: usage?.ai_tokens_used || 0,
      },
    }
  }
}
