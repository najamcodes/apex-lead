# Phase 3 — Prompt 02: Polar.sh Checkout Integration & Webhook Lifecycle

> **Objective:** Integrate Polar.sh as the Merchant of Record (MoR) for subscriptions and credit top-ups, implementing secure checkout creation and HMAC webhook listeners.

---

## 1. Polar.sh Billing Lifecycle Architecture

```
User selects Plan on /pricing
       │
       ▼
POST /api/billing/checkout { tier: 'pro', interval: 'month' }
       │
       ▼
Server calls Polar.sh API: Creates Checkout Session with metadata { org_id: 42 }
Returns Polar Checkout URL: https://polar.sh/checkout/...
       │
       ▼
User completes payment on Polar.sh
       │
       ▼
Polar.sh sends Webhook: POST /api/webhooks/polar
Header: Webhook-Signature / Polar-Signature
       │
       ├─► Verify Webhook HMAC Signature
       │
       ├─► subscription.created / subscription.updated:
       │     - Resolve org_id from metadata
       │     - Update OrganizationEntity.tier = 'pro'
       │     - Store polar_subscription_id & polar_customer_id
       │
       ├─► subscription.canceled / subscription.revoked:
       │     - Downgrade OrganizationEntity.tier = 'free'
       │     - Log audit event
       │
       └─► order.created (Credit Add-ons):
             - Top up leads_exported or ai_tokens quota in organization_usage
```

---

## 2. Polar.sh SDK Service Implementation

### `server/src/services/PolarBillingService.ts`

```ts
import { Polar } from '@polar-sh/sdk'
import { AppDataSource } from '../db/data-source'
import { OrganizationEntity, OrgTier } from '../models/OrganizationEntity'

export class PolarBillingService {
  private polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN || '',
    server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  })

  private orgRepo = AppDataSource.getRepository(OrganizationEntity)

  // Map internal tiers to Polar Product / Price IDs
  private priceMap: Record<string, string> = {
    'starter_monthly': process.env.POLAR_PRICE_STARTER_MONTHLY || 'price_starter_mo',
    'starter_yearly': process.env.POLAR_PRICE_STARTER_YEARLY || 'price_starter_yr',
    'pro_monthly': process.env.POLAR_PRICE_PRO_MONTHLY || 'price_pro_mo',
    'pro_yearly': process.env.POLAR_PRICE_PRO_YEARLY || 'price_pro_yr',
    'agency_monthly': process.env.POLAR_PRICE_AGENCY_MONTHLY || 'price_agency_mo',
    'agency_yearly': process.env.POLAR_PRICE_AGENCY_YEARLY || 'price_agency_yr',
  }

  async createCheckoutUrl(orgId: number, userEmail: string, tier: OrgTier, interval: 'monthly' | 'yearly'): Promise<string> {
    const key = `${tier}_${interval}`
    const productPriceId = this.priceMap[key]
    if (!productPriceId) throw new Error(`Invalid price mapping for ${key}`)

    const checkout = await this.polar.checkouts.custom.create({
      productPriceId,
      customerEmail: userEmail,
      successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?success=true`,
      metadata: {
        org_id: String(orgId),
        tier,
      },
    })

    return checkout.url
  }

  async handleSubscriptionChange(data: any, status: 'active' | 'canceled' | 'updated'): Promise<void> {
    const orgId = Number(data.metadata?.org_id)
    if (!orgId) return

    const org = await this.orgRepo.findOneBy({ id: orgId })
    if (!org) return

    if (status === 'canceled') {
      org.tier = 'free'
    } else {
      org.tier = (data.metadata?.tier || 'pro') as OrgTier
      org.billing_email = data.customer?.email || org.billing_email
    }

    const currentSettings = JSON.parse(org.settings || '{}')
    org.settings = JSON.stringify({
      ...currentSettings,
      polar_subscription_id: data.id,
      polar_customer_id: data.customer_id,
      subscription_status: status,
      current_period_end: data.current_period_end,
    })

    await this.orgRepo.save(org)
  }
}
```

---

## 3. Katal `PolarWebhookController.ts` with HMAC Verification

### `server/src/controllers/PolarWebhookController.ts`

```ts
import { Controller, Post, Body, Header, Context, Inject } from 'katal'
import { createHmac, timingSafeEqual } from 'crypto'
import { PolarBillingService } from '../services/PolarBillingService'

export class PolarWebhookController extends Controller {
  constructor(@Inject() private billingService: PolarBillingService) {
    super()
  }

  @Post('/api/webhooks/polar')
  async handleWebhook(@Body() payload: any, @Header('webhook-signature') signature: string, c: Context) {
    const secret = process.env.POLAR_WEBHOOK_SECRET || ''

    // 1. Verify Webhook Signature
    if (secret) {
      const rawBody = await c.req.text()
      const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex')
      if (!signature || signature !== expectedSig) {
        return c.json({ error: 'Invalid webhook signature' }, 401)
      }
    }

    const event = payload.type

    // 2. Route Polar Events
    switch (event) {
      case 'subscription.created':
      case 'subscription.updated':
        await this.billingService.handleSubscriptionChange(payload.data, 'active')
        break

      case 'subscription.canceled':
      case 'subscription.revoked':
        await this.billingService.handleSubscriptionChange(payload.data, 'canceled')
        break

      case 'order.created':
        // Top-up packs or one-time credit purchases
        break
    }

    return c.json({ received: true }, 200)
  }
}
```

---

## 4. Verification Protocol
- [ ] Call `POST /api/billing/checkout` -> Assert valid Polar checkout URL is returned with embedded `org_id` metadata.
- [ ] Post mock webhook `subscription.created` to `/api/webhooks/polar` with valid HMAC signature.
- [ ] Verify `organizations.tier` in database updates immediately from `free` to `pro`.
- [ ] Post mock webhook `subscription.canceled` -> Verify `organizations.tier` gracefully reverts to `free`.
