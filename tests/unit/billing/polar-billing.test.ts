import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import crypto from 'crypto'
import { initDb, getDataSource } from '@sdk/core/db'
import { PolarBillingService } from '../../../server/src/services/PolarBillingService'
import { OrganizationEntity } from '@sdk/core/db/entities/OrganizationEntity'

describe('Polar.sh MoR Billing & Webhooks (Prompt 02 & 03)', () => {
  let billingService: PolarBillingService

  beforeAll(async () => {
    process.env.DATABASE_URL = ''
    process.env.POLAR_WEBHOOK_SECRET = 'polar_test_secret_xyz123'
    await initDb()
    billingService = new PolarBillingService()
  })

  it('should generate a valid Polar.sh checkout URL with organization metadata', async () => {
    const url = await billingService.createCheckoutUrl(
      42,
      'buyer@growthco.io',
      'pro',
      'monthly'
    )

    expect(url).toBeDefined()
    expect(url).toContain('polar.sh/checkout/')
    expect(url).toContain('org_id=42')
  })

  it('should generate a customer portal session URL', async () => {
    const portalUrl = await billingService.createCustomerPortalSession('cust_polar_999')
    expect(portalUrl).toBeDefined()
    expect(portalUrl).toContain('polar.sh/purchases/portal')
  })

  it('should verify valid HMAC-SHA256 signatures and reject forged webhook payloads', () => {
    const secret = 'polar_test_secret_xyz123'
    const body = JSON.stringify({ type: 'subscription.created', data: { id: 'sub_123' } })

    // Generate valid signature
    const validSignature = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(billingService.verifyWebhookSignature(body, validSignature)).toBe(true)

    // Forged signature
    const forgedSignature = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    expect(billingService.verifyWebhookSignature(body, forgedSignature)).toBe(false)

    // Altered body with valid signature
    const alteredBody = JSON.stringify({ type: 'subscription.created', data: { id: 'sub_tampered' } })
    expect(billingService.verifyWebhookSignature(alteredBody, validSignature)).toBe(false)

    // Missing signature
    expect(billingService.verifyWebhookSignature(body, null)).toBe(false)
  })

  it('should automatically upgrade organization tier to pro upon receiving subscription.created webhook', async () => {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)

    // Create free org
    const org = await orgRepo.save(orgRepo.create({
      name: 'Sub Upgrade Org',
      tier: 'free',
      settings: JSON.stringify({}),
    }))

    // Mock Polar webhook payload
    const payloadData = {
      id: 'sub_polar_abc123',
      customer_id: 'cust_polar_xyz789',
      current_period_end: '2026-11-27T00:00:00Z',
      customer: { email: 'billing@subupgrade.com' },
      metadata: {
        org_id: String(org.id),
        tier: 'pro',
      },
    }

    await billingService.handleSubscriptionChange(payloadData, 'active')

    // Verify DB update
    const updated = await orgRepo.findOneBy({ id: org.id })
    expect(updated).toBeDefined()
    expect(updated!.tier).toBe('pro')
    expect(updated!.billing_email).toBe('billing@subupgrade.com')

    const settings = JSON.parse(updated!.settings || '{}')
    expect(settings.polar_subscription_id).toBe('sub_polar_abc123')
    expect(settings.polar_customer_id).toBe('cust_polar_xyz789')
    expect(settings.subscription_status).toBe('active')
  })

  it('should gracefully downgrade organization tier to free upon receiving subscription.canceled webhook', async () => {
    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)

    const org = await orgRepo.save(orgRepo.create({
      name: 'Sub Downgrade Org',
      tier: 'pro',
      settings: JSON.stringify({
        polar_subscription_id: 'sub_polar_active',
        polar_customer_id: 'cust_polar_active',
      }),
    }))

    const payloadData = {
      id: 'sub_polar_active',
      customer_id: 'cust_polar_active',
      metadata: {
        org_id: String(org.id),
      },
    }

    await billingService.handleSubscriptionChange(payloadData, 'canceled')

    const updated = await orgRepo.findOneBy({ id: org.id })
    expect(updated!.tier).toBe('free')

    const settings = JSON.parse(updated!.settings || '{}')
    expect(settings.subscription_status).toBe('canceled')
  })
})
