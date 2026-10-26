# Phase 4 — Prompt 02: Pricing Page & Interactive ROI Calculator

> **Objective:** Implement a dedicated `/pricing` route with an annual/monthly billing toggle, Polar.sh 1-click checkout buttons, and an interactive lead cost calculator comparing ApexLead vs Apollo.io.

---

## 1. Page Specifications & Layout

The `/pricing` page must communicate extreme value and transparent limits:
1. **Billing Interval Switcher:** Monthly vs Annual (with "Save 20%" badge).
2. **Tier Comparison Cards:** Free ($0), Starter ($29/mo), Pro ($79/mo — *Most Popular* badge with glowing border), Agency ($199/mo).
3. **Interactive ROI Calculator:** Slider allowing prospective buyers to dial their monthly lead volume (e.g., 2,500 leads/mo) and visually see that ApexLead costs $79/mo vs Apollo ($199/mo) vs ZoomInfo ($1,250/mo).
4. **Complete Feature Comparison Table:** Collapsible sections for Scrapers, Verification, AI SDR, and Integrations.
5. **Pricing FAQ:** Handling rollover credits, cancellation policy, and proxy options.

---

## 2. Interactive Calculator Component (`web/components/pricing/LeadCalculator.tsx`)

```tsx
'use client'
import { useState } from 'react'

export function LeadCalculator() {
  const [leadVolume, setLeadVolume] = useState(5000)

  // Comparative Cost Formula
  const apexCost = leadVolume <= 1500 ? 29 : leadVolume <= 7500 ? 79 : 199
  const apolloCost = Math.round((leadVolume / 1000) * 35) + 49
  const zoomInfoCost = Math.round((leadVolume / 1000) * 120) + 800

  const annualSavings = (apolloCost - apexCost) * 12

  return (
    <div className="max-w-4xl mx-auto p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-white">Interactive Cost & Savings Calculator</h3>
        <p className="text-sm text-neutral-400">See how much you save compared to legacy contact databases.</p>
      </div>

      {/* Slider */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-neutral-300">Monthly Verified Leads Required:</span>
          <span className="text-indigo-400 text-lg">{leadVolume.toLocaleString()} Leads</span>
        </div>
        <input
          type="range"
          min={500}
          max={30000}
          step={500}
          value={leadVolume}
          onChange={(e) => setLeadVolume(Number(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer"
        />
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-3 gap-4 pt-4 text-center">
        <div className="p-4 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">ApexLead</div>
          <div className="text-3xl font-extrabold text-white mt-1">${apexCost}<span className="text-xs font-normal text-neutral-400">/mo</span></div>
          <div className="text-xs text-emerald-400 mt-2 font-medium">Save ${annualSavings.toLocaleString()}/yr</div>
        </div>

        <div className="p-4 rounded-xl bg-white/5 border border-white/5 opacity-75">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Apollo.io</div>
          <div className="text-3xl font-extrabold text-neutral-300 mt-1">${apolloCost}<span className="text-xs font-normal text-neutral-400">/mo</span></div>
          <div className="text-xs text-neutral-500 mt-2">Static Database</div>
        </div>

        <div className="p-4 rounded-xl bg-white/5 border border-white/5 opacity-75">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">ZoomInfo</div>
          <div className="text-3xl font-extrabold text-neutral-300 mt-1">${zoomInfoCost}<span className="text-xs font-normal text-neutral-400">/mo</span></div>
          <div className="text-xs text-neutral-500 mt-2">Annual Contract</div>
        </div>
      </div>
    </div>
  )
}
```

---

## 3. Polar.sh Checkout Button Handler

```tsx
// web/components/pricing/PricingCard.tsx
export function PricingCard({ tier, name, price, interval }: any) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url // Redirect to Polar
      }
    } catch {
      alert('Unable to initiate checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="w-full py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
    >
      {loading ? 'Opening Checkout...' : `Upgrade to ${name}`}
    </button>
  )
}
```

---

## 4. Verification Protocol
- [ ] Toggle between Monthly and Annual -> Assert prices update with 20% discount.
- [ ] Move Lead Slider to 5,000 -> Assert ApexLead shows $79/mo and Apollo shows ~$224/mo.
- [ ] Click "Upgrade to Pro" -> Initiates Polar Checkout session and redirects to Polar.sh checkout screen.
