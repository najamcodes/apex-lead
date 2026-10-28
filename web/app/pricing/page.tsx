'use client'

import { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { LeadCalculator } from '@/components/pricing/LeadCalculator'
import { Check, Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react'
import Link from 'next/link'

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true)
  const [loadingTier, setLoadingTier] = useState<string | null>(null)

  const handleCheckout = async (tier: string) => {
    if (tier === 'free') {
      window.location.href = '/login'
      return
    }

    setLoadingTier(tier)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          interval: isAnnual ? 'year' : 'month',
        }),
      })

      const data = await res.json()
      if (data.checkoutUrl || data.url) {
        window.location.href = data.checkoutUrl || data.url
      } else {
        alert(data.message || 'Unable to initiate Polar checkout session.')
      }
    } catch {
      alert('Network error connecting to billing gateway. Please try again.')
    } finally {
      setLoadingTier(null)
    }
  }

  const tiers = [
    {
      id: 'free',
      name: 'Free Starter',
      badge: 'Forever Free',
      monthlyPrice: 0,
      annualPrice: 0,
      description: 'Ideal for solo founders and developers testing live directory scraping.',
      features: [
        '50 Verified Leads / month',
        '10 Waterfall Email Verifications',
        'Hybrid Edge Desktop Worker (0 cloud costs)',
        'Google Maps & Yelp Scrapers',
        'Single Pipeline Execution',
        'CSV & JSON Export',
      ],
      ctaText: 'Start Free Forever',
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      badge: 'Early Traction',
      monthlyPrice: 29,
      annualPrice: 23,
      description: 'For growing SDRs and agencies scaling outbound campaigns.',
      features: [
        '1,500 Verified Leads / month',
        '500 Waterfall Email Verifications',
        '30 Voice AI SDR Calling Minutes',
        'Cloud & Edge Browser Workers',
        '3 Visual DAG Pipelines',
        'Technographic Stack Detection',
        'HubSpot & Webhook Sync',
      ],
      ctaText: 'Upgrade to Starter',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro Outbound',
      badge: 'Most Popular',
      monthlyPrice: 79,
      annualPrice: 63,
      description: 'Full sales intelligence engine for high-velocity revenue teams.',
      features: [
        '7,500 Verified Leads / month',
        '3,000 Waterfall Email Verifications',
        '150 Voice AI SDR Calling Minutes',
        'Unlimited Visual DAG Pipelines',
        'Hunter + Prospeo + Dropcontact Waterfall',
        'Live Website Visitor IP Reveal',
        'Direct Mobile Phone Discovery',
        'Priority Cloud Proxy Routing',
      ],
      ctaText: 'Upgrade to Pro',
      popular: true,
    },
    {
      id: 'agency',
      name: 'Agency Scale',
      badge: 'Maximum Power',
      monthlyPrice: 199,
      annualPrice: 159,
      description: 'Dedicated infrastructure for outbound agencies and enterprise sales orgs.',
      features: [
        '25,000 Verified Leads / month',
        '10,000 Waterfall Email Verifications',
        '500 Voice AI SDR Calling Minutes',
        '10 Team Seats & Multi-Tenancy RBAC',
        'Dedicated Residential Proxy Pool',
        'Custom Webhook & CRM Integrations',
        'Private Slack Channel & Priority SLA',
      ],
      ctaText: 'Upgrade to Agency',
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Transparent & Predictable Billing</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              Predictable Pricing.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Zero Stale Data.
              </span>
            </h1>
            <p className="text-neutral-400 text-lg">
              No 5-figure annual contracts or surprise overage bills. Scale on demand and cancel anytime via Polar.sh.
            </p>

            {/* Billing Interval Toggle */}
            <div className="pt-6 flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-neutral-400'}`}>
                Monthly Billing
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="relative w-14 h-8 rounded-full bg-white/10 p-1 transition-colors border border-white/10 focus:outline-none"
              >
                <div
                  className={`w-6 h-6 rounded-full bg-indigo-500 transition-transform ${
                    isAnnual ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isAnnual ? 'text-white' : 'text-neutral-400'}`}>
                  Annual Billing
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  Save 20%
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((t) => {
              const price = isAnnual ? t.annualPrice : t.monthlyPrice
              return (
                <div
                  key={t.id}
                  className={`relative p-8 rounded-3xl border flex flex-col justify-between transition-all duration-300 ${
                    t.popular
                      ? 'bg-gradient-to-b from-indigo-950/40 via-neutral-900/60 to-neutral-950 border-indigo-500/50 shadow-2xl shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  {t.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {t.badge}
                      </div>
                      <h3 className="text-2xl font-bold text-white mt-1">{t.name}</h3>
                      <p className="text-xs text-neutral-400 mt-2 min-h-[32px] leading-relaxed">
                        {t.description}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">${price}</span>
                      <span className="text-neutral-400 text-xs">/month</span>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                        What&apos;s Included:
                      </div>
                      <ul className="space-y-2.5">
                        {t.features.map((feat, fi) => (
                          <li key={fi} className="flex items-start gap-2.5 text-xs text-neutral-300 leading-snug">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-8">
                    <button
                      onClick={() => handleCheckout(t.id)}
                      disabled={loadingTier === t.id}
                      className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                        t.popular
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      <span>
                        {loadingTier === t.id ? 'Connecting to Polar...' : t.ctaText}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Interactive ROI Calculator */}
          <div className="pt-12">
            <LeadCalculator />
          </div>

          {/* Guarantees */}
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="space-y-2">
              <ShieldCheck className="w-8 h-8 text-indigo-400 mx-auto" />
              <div className="font-bold text-white text-sm">Merchant of Record Security</div>
              <p className="text-xs text-neutral-400">All payments processed via Polar.sh with end-to-end TLS encryption.</p>
            </div>
            <div className="space-y-2">
              <Zap className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-bold text-white text-sm">Instant Credit Activation</div>
              <p className="text-xs text-neutral-400">Upgrades take effect immediately upon checkout completion.</p>
            </div>
            <div className="space-y-2">
              <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
              <div className="font-bold text-white text-sm">Cancel With 1-Click</div>
              <p className="text-xs text-neutral-400">Manage or cancel your subscription anytime via your customer portal.</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
