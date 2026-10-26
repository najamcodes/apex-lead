# Phase 3 — Prompt 03: Customer Portal & Subscription Synchronization

> **Objective:** Provide a self-service billing management interface via Polar Customer Portal, real-time subscription status synchronization, and an in-app billing dashboard.

---

## 1. Polar Customer Portal Architecture

Instead of building custom credit card update and PDF invoice download systems, Polar provides an out-of-the-box, secure **Customer Portal**:

```
User clicks "Manage Billing & Invoices" in Settings
       │
       ▼
GET /api/billing/portal
       │
       ▼
Server fetches polar_customer_id from OrganizationEntity.settings
Calls Polar SDK: polar.customerSessions.create({ customerId })
Returns Polar Portal URL: https://polar.sh/purchases/portal?...
       │
       ▼
Browser redirects to Polar Customer Portal
User can:
  - Download official tax invoices (PDF)
  - Update credit card / payment method
  - Cancel or upgrade subscription
```

---

## 2. Portal Session Generation Endpoint

### In `server/src/controllers/BillingController.ts`

```ts
import { Controller, Get, Post, Body, Context, Inject } from 'katal'
import { PolarBillingService } from '../services/PolarBillingService'
import { OrganizationRepository } from '../repositories/OrganizationRepository'

export class BillingController extends Controller {
  constructor(
    @Inject() private billingService: PolarBillingService,
    @Inject() private orgRepo: OrganizationRepository
  ) {
    super()
  }

  @Get('/api/billing/status')
  async getStatus(c: Context) {
    const orgId = c.get('tenantId')
    const org = await this.orgRepo.findById(orgId)
    if (!org) return c.json({ error: 'Org not found' }, 404)

    const usage = await this.billingService.getCurrentUsage(orgId)
    return c.json({
      success: true,
      tier: org.tier || 'free',
      billingEmail: org.billing_email,
      usage,
    })
  }

  @Get('/api/billing/portal')
  async getCustomerPortalUrl(c: Context) {
    const orgId = c.get('tenantId')
    const org = await this.orgRepo.findById(orgId)
    if (!org) return c.json({ error: 'Org not found' }, 404)

    const settings = JSON.parse(org.settings || '{}')
    const customerId = settings.polar_customer_id

    if (!customerId) {
      return c.json({ error: 'No active subscription or customer found on Polar' }, 400)
    }

    const portalUrl = await this.billingService.createCustomerPortalSession(customerId)
    return c.json({ success: true, url: portalUrl })
  }
}
```

---

## 3. In-App Billing UI Component (`web/app/settings/billing/page.tsx`)

A modern, glassmorphic billing dashboard showing:
1. **Current Plan Badge & Billing Cycle End Date.**
2. **Quota Usage Progress Bars:**
   - Lead Export Credits: `1,250 / 7,500` (17%)
   - AI Tokens: `320 / 2,500` (13%)
   - Cloud Browser Scrapes: `14 / 100` (14%)
3. **Action Triggers:**
   - "Manage Subscription & Invoices" -> Opens Polar Portal.
   - "Upgrade to Agency" CTA card.

```tsx
// Excerpt from web/app/settings/billing/page.tsx
export default function BillingSettingsPage() {
  const { data: billing, isLoading } = useBillingStatus()

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription & Usage</h1>
          <p className="text-sm text-neutral-400">Manage your organization's plan, quotas, and invoices.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
          {billing?.tier} Plan
        </span>
      </div>

      {/* Quota Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UsageCard title="Lead Export Credits" used={billing?.usage?.leads} limit={billing?.usage?.limits?.leads} />
        <UsageCard title="Cloud Scraper Runs" used={billing?.usage?.cloudScrapes} limit={billing?.usage?.limits?.cloudScrapes} />
        <UsageCard title="AI SDR Tokens" used={billing?.usage?.aiCalls} limit={billing?.usage?.limits?.aiCalls} />
      </div>

      {/* Portal CTA */}
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Payment Method & Invoices</h3>
          <p className="text-sm text-neutral-400">View past tax invoices, update credit card, or change billing details via Polar.</p>
        </div>
        <button
          onClick={handleOpenPolarPortal}
          className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:bg-neutral-200 transition"
        >
          Open Customer Portal →
        </button>
      </div>
    </div>
  )
}
```

---

## 4. Verification Protocol
- [ ] Call `GET /api/billing/status` -> Assert JSON returns current plan and usage metrics.
- [ ] Call `GET /api/billing/portal` for an org with `polar_customer_id` -> Assert valid Polar session URL returned.
- [ ] Load `/settings/billing` in web browser -> Verify usage bars render accurately matching database values.
