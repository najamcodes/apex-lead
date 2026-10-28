import crypto from 'crypto'
import { getDataSource } from '../db'
import { OrganizationEntity } from '../db/entities/OrganizationEntity'
import { QuotaService } from './QuotaService'

export interface PolarWebhookData {
  id?: string
  customer_id?: string
  current_period_end?: string
  metadata?: Record<string, unknown>
  customer?: { id?: string; email?: string }
}

export class PolarBillingService {
  private apiBase = process.env.POLAR_API_BASE || (process.env.NODE_ENV === 'production'
    ? 'https://api.polar.sh/v1'
    : 'https://sandbox-api.polar.sh/v1')

  private accessToken = process.env.POLAR_ACCESS_TOKEN || ''
  private webhookSecret = process.env.POLAR_WEBHOOK_SECRET || ''

  private priceMap: Record<string, string> = {
    starter_monthly: process.env.POLAR_PRICE_STARTER_MONTHLY || 'price_starter_mo',
    starter_yearly: process.env.POLAR_PRICE_STARTER_YEARLY || 'price_starter_yr',
    pro_monthly: process.env.POLAR_PRICE_PRO_MONTHLY || 'price_pro_mo',
    pro_yearly: process.env.POLAR_PRICE_PRO_YEARLY || 'price_pro_yr',
    agency_monthly: process.env.POLAR_PRICE_AGENCY_MONTHLY || 'price_agency_mo',
    agency_yearly: process.env.POLAR_PRICE_AGENCY_YEARLY || 'price_agency_yr',
  }

  async createCheckoutUrl(
    orgId: number,
    userEmail: string,
    tier: string,
    interval: 'monthly' | 'yearly' = 'monthly'
  ): Promise<string> {
    const key = `${tier.toLowerCase()}_${interval}`
    const productPriceId = this.priceMap[key] || this.priceMap.pro_monthly
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const successUrl = `${frontendUrl}/settings/billing?success=true&tier=${tier}`

    if (!this.accessToken) {
      // In local dev/testing without Polar API key, provide sandbox checkout URL
      return `https://sandbox.polar.sh/checkout/mock_${key}?org_id=${orgId}&email=${encodeURIComponent(userEmail)}&success_url=${encodeURIComponent(successUrl)}`
    }

    const res = await fetch(`${this.apiBase}/checkouts/custom/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_price_id: productPriceId,
        customer_email: userEmail,
        success_url: successUrl,
        metadata: {
          org_id: String(orgId),
          tier: tier.toLowerCase(),
        },
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Polar checkout creation failed: ${errorText}`)
    }

    const data = (await res.json()) as { url: string }
    return data.url
  }

  async createCustomerPortalSession(customerId: string): Promise<string> {
    if (!this.accessToken) {
      return `https://sandbox.polar.sh/purchases/portal?customer_id=${customerId}`
    }

    const res = await fetch(`${this.apiBase}/customer-sessions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Failed to create Polar portal session: ${errorText}`)
    }

    const data = (await res.json()) as { customer_portal_url?: string; url?: string }
    return data.customer_portal_url || data.url || `https://polar.sh/purchases/portal`
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = this.webhookSecret
    if (!secret) {
      // In dev environment with no webhook secret configured, allow testing
      return true
    }
    if (!signature) return false

    try {
      const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
      const sigBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
      const computedBuffer = Buffer.from(computed, 'hex')

      if (sigBuffer.length !== computedBuffer.length) return false
      return crypto.timingSafeEqual(sigBuffer, computedBuffer)
    } catch {
      return false
    }
  }

  async handleSubscriptionChange(data: PolarWebhookData, status: 'active' | 'canceled' | 'updated'): Promise<void> {
    const orgId = Number(data.metadata?.org_id)
    if (!orgId) return

    const ds = getDataSource()
    const orgRepo = ds.getRepository(OrganizationEntity)
    const org = await orgRepo.findOneBy({ id: orgId })
    if (!org) return

    if (status === 'canceled') {
      org.tier = 'free'
    } else {
      org.tier = String(data.metadata?.tier || 'pro').toLowerCase()
      if (data.customer?.email) {
        org.billing_email = data.customer.email
      }
    }

    const currentSettings = JSON.parse(org.settings || '{}')
    org.settings = JSON.stringify({
      ...currentSettings,
      polar_subscription_id: data.id || null,
      polar_customer_id: data.customer_id || data.customer?.id || currentSettings.polar_customer_id || null,
      subscription_status: status,
      current_period_end: data.current_period_end || null,
      updated_at: new Date().toISOString(),
    })

    await orgRepo.save(org)
  }

  async handleOrderCreated(data: PolarWebhookData): Promise<void> {
    const orgId = Number(data.metadata?.org_id)
    if (!orgId) return

    const creditsToAdd = Number(data.metadata?.topup_leads || 0)
    if (creditsToAdd > 0) {
      const quotaService = new QuotaService()
      // Subtract from usage or augment allowance
      await quotaService.consumeQuota(orgId, 'leads', -creditsToAdd)
    }
  }
}
