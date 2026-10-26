# Phase 3 — Prompt 01: Pricing Tiers, Quota Enforcement & Feature Gating

> **Objective:** Define and enforce the 4-tier commercial pricing model, tracking monthly usage quotas (export credits, cloud scrapers, AI tokens, seats) with middleware-level feature gating.

---

## 1. Commercial Pricing Matrix & Feature Entitlements

| Tier Feature / Entitlement | **Free / Community** ($0/mo) | **Starter (Solo)** ($29/mo) | **Pro (Growth)** ($79/mo) | **Agency (Scale)** ($199/mo) |
| :--- | :---: | :---: | :---: | :---: |
| **Monthly Lead Export Credits** | 50 leads | 1,500 leads | 7,500 leads | 25,000 leads |
| **HTTP Scrapers (YellowPages/ThomasNet)** |  Included |  Included (Fast) |  Included (Priority) |  Unlimited Priority |
| **Cloud Playwright Scrapers (Google Maps)** | ❌ *Desktop App Only* | ❌ *Desktop App Only* |  **Included (Cloud)** |  **Included (High Concurrency)** |
| **Desktop Worker Local Mode** |  Unlimited |  Unlimited |  Unlimited |  Unlimited |
| **Email Waterfall & Verification** | Basic Syntax | 500 verifications | 3,000 verifications | 15,000 verifications |
| **AI Personalizer / Decision Tokens** | 25 calls | 500 calls | 2,500 calls | 10,000 calls |
| **Connected Mailbox Rotation** | 1 account | 3 accounts | 10 accounts | 30 accounts |
| **Team Member Seats** | 1 seat | 2 seats | 5 seats | 15 seats |
| **API & Webhook Dispatch** | ❌ None | ❌ None |  Included |  Included |

---

## 2. Organization Usage & Quota Database Model

### `server/src/models/OrganizationUsageEntity.ts`

```ts
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index, Unique } from 'typeorm'

@Entity('organization_usage')
@Unique(['org_id', 'billing_period'])
export class OrganizationUsageEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ type: 'int' })
  @Index()
  org_id!: number

  @Column({ type: 'varchar', length: 7 }) // Format: 'YYYY-MM', e.g. '2026-10'
  billing_period!: string

  @Column({ type: 'int', default: 0 })
  leads_exported!: number

  @Column({ type: 'int', default: 0 })
  cloud_scrapes_executed!: number

  @Column({ type: 'int', default: 0 })
  waterfall_checks_used!: number

  @Column({ type: 'int', default: 0 })
  ai_tokens_used!: number

  @UpdateDateColumn()
  updated_at!: Date
}
```

---

## 3. Quota Enforcement Service

### `server/src/services/QuotaService.ts`

```ts
import { AppDataSource } from '../db/data-source'
import { OrganizationEntity, OrgTier } from '../models/OrganizationEntity'
import { OrganizationUsageEntity } from '../models/OrganizationUsageEntity'

export const TIER_LIMITS: Record<OrgTier, {
  leads: number
  cloudScrapes: number
  waterfall: number
  aiCalls: number
  seats: number
  allowCloudScraper: boolean
}> = {
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
  enterprise: {
    leads: 25000,
    cloudScrapes: 500,
    waterfall: 15000,
    aiCalls: 10000,
    seats: 15,
    allowCloudScraper: true,
  },
}

export class QuotaService {
  private orgRepo = AppDataSource.getRepository(OrganizationEntity)
  private usageRepo = AppDataSource.getRepository(OrganizationUsageEntity)

  private currentPeriod(): string {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  async checkQuota(orgId: number, feature: 'leads' | 'cloudScrapes' | 'waterfall' | 'aiCalls', quantity = 1): Promise<{ allowed: boolean; remaining: number }> {
    const org = await this.orgRepo.findOneByOrFail({ id: orgId })
    const tier = (org.tier || 'free') as OrgTier
    const limits = TIER_LIMITS[tier]

    // Feature gating check
    if (feature === 'cloudScrapes' && !limits.allowCloudScraper) {
      return { allowed: false, remaining: 0 }
    }

    const period = this.currentPeriod()
    let usage = await this.usageRepo.findOne({ where: { org_id: orgId, billing_period: period } })
    if (!usage) {
      usage = this.usageRepo.create({ org_id: orgId, billing_period: period })
      await this.usageRepo.save(usage)
    }

    const currentUsage = {
      leads: usage.leads_exported,
      cloudScrapes: usage.cloud_scrapes_executed,
      waterfall: usage.waterfall_checks_used,
      aiCalls: usage.ai_tokens_used,
    }[feature]

    const limit = limits[feature]
    const remaining = Math.max(0, limit - currentUsage)

    return {
      allowed: currentUsage + quantity <= limit,
      remaining,
    }
  }

  async consumeQuota(orgId: number, feature: 'leads' | 'cloudScrapes' | 'waterfall' | 'aiCalls', quantity = 1): Promise<void> {
    const period = this.currentPeriod()
    const updateField = {
      leads: 'leads_exported',
      cloudScrapes: 'cloud_scrapes_executed',
      waterfall: 'waterfall_checks_used',
      aiCalls: 'ai_tokens_used',
    }[feature]

    await this.usageRepo
      .createQueryBuilder()
      .update(OrganizationUsageEntity)
      .set({ [updateField]: () => `${updateField} + ${quantity}` } as any)
      .where('org_id = :orgId AND billing_period = :period', { orgId, period })
      .execute()
  }
}
```

---

## 4. Quota Enforcement Middleware in Katal

```ts
// server/src/middleware/EnforceQuota.ts
import { Middleware, Context } from 'katal'
import { QuotaService } from '../services/QuotaService'

export function enforceQuota(feature: 'leads' | 'cloudScrapes' | 'waterfall' | 'aiCalls', quantity = 1): Middleware {
  return async (c: Context, next: () => Promise<void>) => {
    const orgId = c.get('tenantId')
    const quotaService = new QuotaService()
    const check = await quotaService.checkQuota(orgId, feature, quantity)

    if (!check.allowed) {
      return c.json({
        error: `Monthly quota exceeded for ${feature}. Upgrade your plan to unlock more credits.`,
        remaining: check.remaining,
        upgradeUrl: '/pricing',
      }, 402) // Payment Required
    }

    await next()
  }
}
```

---

## 5. Verification Protocol
- [ ] A Free tier organization runs an export of 60 leads -> First 50 succeed, subsequent export blocked with HTTP 402 Payment Required.
- [ ] Free tier attempts to launch server-side Google Maps scraper -> Blocked with HTTP 402: "Cloud browser scraping requires Pro tier. Run via Desktop App or upgrade".
- [ ] Running scraper in Desktop App Worker mode -> Bypasses cloud scraper quota and consumes 0 cloud browser credits.
