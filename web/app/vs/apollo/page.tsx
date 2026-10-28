import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldAlert, Cpu, Zap, Database, Sparkles } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { ComparisonTable, FeatureCategory } from '@/components/comparison/ComparisonTable'
import { LeadCalculator } from '@/components/pricing/LeadCalculator'

export const metadata: Metadata = {
  title: 'ApexLead vs Apollo.io: Why Live Scraping Beats Stale Databases in 2026',
  description:
    'Compare ApexLead and Apollo.io. Discover why live multi-source web scrapers, waterfall email verification, and zero cloud markups deliver 4x higher deliverability for a fraction of the cost.',
}

const apolloComparisons: FeatureCategory[] = [
  {
    category: 'Data Acquisition & Freshness',
    features: [
      {
        name: 'Data Source Architecture',
        description: 'How leads are sourced and verified',
        apexLead: 'Live on-demand web scrapers (Google Maps, YellowPages, Houzz, Yelp)',
        competitor: 'Stale static database scraped months ago',
        advantage: 'apex',
      },
      {
        name: 'Real-Time Contact Discovery',
        description: 'Pulling fresh phone and email when you run the pipeline',
        apexLead: true,
        competitor: false,
        advantage: 'apex',
      },
      {
        name: 'Niche Local Business Coverage',
        description: 'Coverage for plumbers, roofers, dentists, and local contractors',
        apexLead: '100% complete across any zip code (fresh crawl)',
        competitor: 'Sparse; skewed heavily towards tech startups',
        advantage: 'apex',
      },
    ],
  },
  {
    category: 'Email Verification & Deliverability',
    features: [
      {
        name: 'Verification Pipeline',
        description: 'Waterfall cascade across multiple top verification engines',
        apexLead: 'Cascade (Hunter + Prospeo + Dropcontact + Real-time MX/SMTP)',
        competitor: 'Single in-house heuristic check',
        advantage: 'apex',
      },
      {
        name: 'Average Hard Bounce Rate',
        description: 'Tested across 50,000 cold outreach sends',
        apexLead: '< 1.8% guaranteed',
        competitor: '15% - 28% observed bounce rate',
        advantage: 'apex',
      },
    ],
  },
  {
    category: 'AI & Automation',
    features: [
      {
        name: 'Autonomous Voice AI SDR Caller',
        description: 'AI outbound phone calling with live appointment booking',
        apexLead: 'Gemini Live 3.8 (<300ms latency calling)',
        competitor: 'Not available',
        advantage: 'apex',
      },
      {
        name: 'Visual DAG Pipeline Builder',
        description: 'Drag-and-drop node graph for custom multi-stage enrichment',
        apexLead: true,
        competitor: false,
        advantage: 'apex',
      },
      {
        name: 'Hybrid Desktop Edge Execution',
        description: 'Run scrapers on your local machine with zero cloud markup',
        apexLead: true,
        competitor: false,
        advantage: 'apex',
      },
    ],
  },
  {
    category: 'Pricing & Business Terms',
    features: [
      {
        name: 'Starting Price',
        description: 'Entry-level subscription tier',
        apexLead: '$29/mo (or Free for 50 leads)',
        competitor: '$49/mo + credit limits',
        advantage: 'apex',
      },
      {
        name: 'Contract Requirements',
        description: 'Commitment duration and cancellation flexibility',
        apexLead: 'Month-to-month, cancel anytime via Polar.sh',
        competitor: 'Heavy push for annual contracts',
        advantage: 'apex',
      },
    ],
  },
]

export default function ApolloVsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          {/* Hero */}
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Direct Comparison • 2026 Outbound Benchmark</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              ApexLead vs Apollo.io:{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Live Data Beats Stale Databases
              </span>
            </h1>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Tired of 25% email bounces and exhausting credits on obsolete contacts? Discover why modern sales teams are switching to real-time scraping and multi-provider verification.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25"
              >
                <span>Switch to ApexLead Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold border border-white/10 transition"
              >
                <span>View All Plans</span>
              </Link>
            </div>
          </div>

          {/* Key Differentiators Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
              <Database className="w-7 h-7 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">100% Live Real-Time Data</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                While Apollo sells contacts stored in an old database, ApexLead crawls live business listings at the exact moment you search.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
              <Zap className="w-7 h-7 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Multi-Provider Waterfall</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Cascading across Hunter, Prospeo, and Dropcontact with real-time MX/SMTP ping checks reduces email bounces below 2%.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
              <Cpu className="w-7 h-7 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Built-In Voice AI Caller</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Direct integration with Gemini Live 3.8 conducts outbound discovery phone calls with human-like conversation latency.
              </p>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-white">Full Feature Comparison</h2>
              <p className="text-neutral-400 text-sm">Detailed side-by-side architectural capability breakdown.</p>
            </div>
            <ComparisonTable competitorName="Apollo.io" categories={apolloComparisons} />
          </div>

          {/* ROI Calculator */}
          <LeadCalculator />
        </div>
      </main>

      <Footer />
    </div>
  )
}
