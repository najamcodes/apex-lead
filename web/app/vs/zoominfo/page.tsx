import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, DollarSign, ShieldAlert, Cpu, Sparkles, Building2 } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { ComparisonTable, FeatureCategory } from '@/components/comparison/ComparisonTable'
import { LeadCalculator } from '@/components/pricing/LeadCalculator'

export const metadata: Metadata = {
  title: 'ApexLead vs ZoomInfo: Why Teams Are Replacing $15k Contracts with Live Data',
  description:
    'Compare ApexLead and ZoomInfo. Break free from $15,000+ annual lock-in contracts with live on-demand web scrapers, multi-provider verification, and autonomous voice AI callers.',
}

const zoominfoComparisons: FeatureCategory[] = [
  {
    category: 'Cost & Contract Terms',
    features: [
      {
        name: 'Annual Investment',
        description: 'Typical annual licensing cost for a 5-person sales team',
        apexLead: '$948 - $2,388 / year total ($79 - $199/mo)',
        competitor: '$15,000 - $40,000+ / year locked-in',
        advantage: 'apex',
      },
      {
        name: 'Contract Length & Cancellation',
        description: 'Flexibility to pause or terminate subscription',
        apexLead: 'Month-to-month via Polar.sh • Cancel anytime with 1 click',
        competitor: 'Strict 1 to 3 year contracts with auto-renewal clauses',
        advantage: 'apex',
      },
      {
        name: 'Per-User Seat Penalties',
        description: 'Charges for additional team members',
        apexLead: 'Generous multi-seat plans included',
        competitor: 'Steep per-seat licensing fees',
        advantage: 'apex',
      },
    ],
  },
  {
    category: 'Data Accuracy & Local Coverage',
    features: [
      {
        name: 'Local Contractor & SMB Coverage',
        description: 'Depth in HVAC, plumbers, roofers, dentists, and regional SMBs',
        apexLead: '100% complete via real-time Google Maps & local directory crawl',
        competitor: 'Poor SMB coverage; heavily enterprise & tech enterprise focused',
        advantage: 'apex',
      },
      {
        name: 'Data Freshness',
        description: 'Latency between business update and your prospect list',
        apexLead: 'Zero latency — live crawled at query time',
        competitor: 'Months between static repository crawls',
        advantage: 'apex',
      },
      {
        name: 'Email Deliverability Guarantee',
        description: 'Observed cold outreach bounce rate',
        apexLead: '< 1.8% with multi-provider waterfall + live MX check',
        competitor: '10% - 20% bounce rate on cached emails',
        advantage: 'apex',
      },
    ],
  },
  {
    category: 'Automation & Modern Capabilities',
    features: [
      {
        name: 'Autonomous Voice AI Calling',
        description: 'Real-time outbound qualification calls and meeting scheduling',
        apexLead: 'Included (Gemini Live 3.8 sub-300ms latency)',
        competitor: 'Not available (requires separate dialer + SDR hires)',
        advantage: 'apex',
      },
      {
        name: 'Local Desktop Worker Execution',
        description: 'Ability to scrape through your desktop machine with zero cloud markup',
        apexLead: true,
        competitor: false,
        advantage: 'apex',
      },
      {
        name: 'Visual DAG Pipeline Customization',
        description: 'Node-based drag & drop pipeline customization',
        apexLead: true,
        competitor: false,
        advantage: 'apex',
      },
    ],
  },
]

export default function ZoomInfoVsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          {/* Hero */}
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise Alternative • 90% Cost Reduction</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              ApexLead vs ZoomInfo:{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Say Goodbye to $15k Lock-ins
              </span>
            </h1>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Why lock your sales budget into a multi-year contract for stale database records? Get fresh on-demand leads, multi-provider waterfall enrichment, and AI voice callers at 1/10th the price.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25"
              >
                <span>Try ApexLead Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold border border-white/10 transition"
              >
                <span>Compare Pricing Tiers</span>
              </Link>
            </div>
          </div>

          {/* Value Highlights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
              <DollarSign className="w-7 h-7 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Save $13,000+ Annually</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Replace five-figure enterprise contracts with a flexible $29-$199/month subscription billed transparently through Polar.sh.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
              <Building2 className="w-7 h-7 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Superior SMB & Local Data</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                ZoomInfo struggles with local contractors, trades, and SMBs. ApexLead crawls Google Maps and specialized directories on demand.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
              <Cpu className="w-7 h-7 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Autonomous Voice AI SDR</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                ZoomInfo requires hiring manual SDRs to dial prospects. ApexLead includes autonomous Gemini Live 3.8 conversational callers.
              </p>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-white">Detailed Head-to-Head Comparison</h2>
              <p className="text-neutral-400 text-sm">Every contractual, accuracy, and feature metric examined.</p>
            </div>
            <ComparisonTable competitorName="ZoomInfo" categories={zoominfoComparisons} />
          </div>

          {/* Lead Calculator */}
          <LeadCalculator />
        </div>
      </main>

      <Footer />
    </div>
  )
}
