import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb, getDataSource } from '@sdk/core/db'
import { QuotaService } from '../../../server/src/services/QuotaService'
import { enforceQuota } from '../../../server/src/middleware/EnforceQuota'
import { OrganizationEntity } from '@sdk/core/db/entities/OrganizationEntity'

describe('Commercial Pricing Tiers & Quota Enforcement (Prompt 01)', () => {
  let quotaService: QuotaService

  beforeAll(async () => {
    process.env.DATABASE_URL = ''
    await initDb()
    quotaService = new QuotaService()
  })

  it('should block cloud browser scraping on Free and Starter tiers, but allow on Pro tier', async () => {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)

    // Free Org
    const freeOrg = await orgRepo.save(orgRepo.create({ name: 'Free Tier Org', tier: 'free' }))
    const freeCheck = await quotaService.checkQuota(freeOrg.id, 'cloudScrapes', 1)
    expect(freeCheck.allowed).toBe(false)
    expect(freeCheck.remaining).toBe(0)

    // Starter Org
    const starterOrg = await orgRepo.save(orgRepo.create({ name: 'Starter Tier Org', tier: 'starter' }))
    const starterCheck = await quotaService.checkQuota(starterOrg.id, 'cloudScrapes', 1)
    expect(starterCheck.allowed).toBe(false)

    // Pro Org
    const proOrg = await orgRepo.save(orgRepo.create({ name: 'Pro Tier Org', tier: 'pro' }))
    const proCheck = await quotaService.checkQuota(proOrg.id, 'cloudScrapes', 1)
    expect(proCheck.allowed).toBe(true)
    expect(proCheck.remaining).toBe(100)
  })

  it('should allow lead export within tier quota and track consumption atomically', async () => {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)

    const org = await orgRepo.save(orgRepo.create({ name: 'Quota Tracking Org', tier: 'free' }))

    // Free tier has limit of 50 leads
    const check1 = await quotaService.checkQuota(org.id, 'leads', 30)
    expect(check1.allowed).toBe(true)
    expect(check1.remaining).toBe(50)

    // Consume 30 leads
    await quotaService.consumeQuota(org.id, 'leads', 30)

    const check2 = await quotaService.checkQuota(org.id, 'leads', 20)
    expect(check2.allowed).toBe(true)
    expect(check2.remaining).toBe(20)

    // Attempting to consume 25 leads when only 20 remain should be disallowed
    const check3 = await quotaService.checkQuota(org.id, 'leads', 25)
    expect(check3.allowed).toBe(false)
    expect(check3.remaining).toBe(20)
  })

  it('should trigger HTTP 402 Payment Required via enforceQuota middleware when limit is exceeded', async () => {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)

    const org = await orgRepo.save(orgRepo.create({ name: 'Exhausted Quota Org', tier: 'free' }))
    // Consume all 50 free leads
    await quotaService.consumeQuota(org.id, 'leads', 50)

    const middleware = enforceQuota('leads', 1)
    const context = {
      user: { orgId: org.id },
      state: { tenantId: org.id },
    }

    let nextCalled = false
    const res = await middleware(context, async () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(false)
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(402)

    const body = await res.json()
    expect(body.error).toContain('Monthly quota exceeded')
    expect(body.upgradeUrl).toBe('/pricing')
    expect(body.remaining).toBe(0)
  })

  it('should retrieve accurate usage and limit metrics for billing dashboard', async () => {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)

    const org = await orgRepo.save(orgRepo.create({
      name: 'Metrics Org',
      tier: 'pro',
      billing_email: 'billing@metrics.com',
    }))

    await quotaService.consumeQuota(org.id, 'leads', 1250)
    await quotaService.consumeQuota(org.id, 'cloudScrapes', 14)
    await quotaService.consumeQuota(org.id, 'aiCalls', 320)

    const status = await quotaService.getUsageAndLimits(org.id)
    expect(status.tier).toBe('pro')
    expect(status.billingEmail).toBe('billing@metrics.com')
    expect(status.limits.leads).toBe(7500)
    expect(status.limits.cloudScrapes).toBe(100)
    expect(status.limits.aiCalls).toBe(2500)
    expect(status.usage.leads).toBe(1250)
    expect(status.usage.cloudScrapes).toBe(14)
    expect(status.usage.aiCalls).toBe(320)
  })
})
