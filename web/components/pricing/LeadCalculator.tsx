'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, TrendingUp, DollarSign } from 'lucide-react'

export function LeadCalculator() {
  const [leadVolume, setLeadVolume] = useState(5000)

  // Comparative Cost Formulas
  const apexCost = leadVolume <= 1500 ? 29 : leadVolume <= 7500 ? 79 : 199
  const apolloCost = Math.round((leadVolume / 1000) * 35) + 49
  const zoomInfoCost = Math.round((leadVolume / 1000) * 120) + 800

  const monthlySavings = apolloCost - apexCost
  const annualSavings = monthlySavings * 12

  return (
    <div className="max-w-4xl mx-auto p-8 rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 space-y-8 backdrop-blur-xl shadow-2xl">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Transparent Commercial Savings</span>
        </div>
        <h3 className="text-3xl font-extrabold text-white">Interactive Cost & ROI Calculator</h3>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto">
          Compare the real monthly cost of live on-demand data extraction versus paying for stale cached databases.
        </p>
      </div>

      {/* Slider Controls */}
      <div className="space-y-4 p-6 rounded-2xl bg-black/40 border border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-300">Target Monthly Verified Leads:</span>
          <span className="text-2xl font-black text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-xl border border-indigo-500/20">
            {leadVolume.toLocaleString()} Leads/mo
          </span>
        </div>
        <input
          type="range"
          min={500}
          max={30000}
          step={500}
          value={leadVolume}
          onChange={(e) => setLeadVolume(Number(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer h-2 bg-neutral-800 rounded-lg appearance-none"
        />
        <div className="flex justify-between text-[11px] text-neutral-500 font-mono">
          <span>500 (Solo)</span>
          <span>7,500 (Growth)</span>
          <span>15,000 (Scale)</span>
          <span>30,000 (Enterprise)</span>
        </div>
      </div>

      {/* Cost Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ApexLead Card */}
        <div className="relative p-6 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/20 flex flex-col justify-between">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white uppercase tracking-wider">
            Best Value
          </div>
          <div>
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">ApexLead</div>
            <div className="text-4xl font-black text-white mt-2">
              ${apexCost}
              <span className="text-xs font-normal text-neutral-400">/mo</span>
            </div>
            <div className="text-xs text-neutral-300 mt-2 space-y-1">
              <div>✓ 100% Real-time Fresh Data</div>
              <div>✓ Unlimited Desktop Scraper</div>
              <div>✓ Waterfall Verification</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-indigo-500/30 text-xs font-semibold text-emerald-400">
            Save ${annualSavings.toLocaleString()} / year
          </div>
        </div>

        {/* Apollo Card */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 opacity-80 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Apollo.io</div>
            <div className="text-4xl font-black text-neutral-300 mt-2">
              ${apolloCost}
              <span className="text-xs font-normal text-neutral-500">/mo</span>
            </div>
            <div className="text-xs text-neutral-400 mt-2 space-y-1">
              <div>• Base $49 + credit fees</div>
              <div>• Static cached database</div>
              <div>• ~25% bounce rate</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 text-xs text-neutral-500 font-mono">
            Requires extra credits
          </div>
        </div>

        {/* ZoomInfo Card */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 opacity-80 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">ZoomInfo</div>
            <div className="text-4xl font-black text-neutral-300 mt-2">
              ${zoomInfoCost}
              <span className="text-xs font-normal text-neutral-500">/mo</span>
            </div>
            <div className="text-xs text-neutral-400 mt-2 space-y-1">
              <div>• Minimum $15k/yr contract</div>
              <div>• Sales rep lock-in</div>
              <div>• Export restrictions</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 text-xs text-rose-400/80 font-mono">
            Annual commitment only
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition shadow-lg"
        >
          <span>View All Plans & Features</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
