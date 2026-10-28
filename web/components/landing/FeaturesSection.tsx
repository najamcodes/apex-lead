import { Globe2, Layers, Cpu, PhoneCall, ShieldCheck, Zap, Laptop, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function FeaturesSection() {
  const features = [
    {
      icon: Globe2,
      badge: 'Live Data Engine',
      title: 'Real-Time Directory Scraping',
      description:
        'Never rely on a 12-month-old stale database again. Extract live business listings directly from Google Maps, YellowPages, Houzz, Yelp, and specialized contractor registries with fresh owner contacts.',
      color: 'from-blue-500/20 to-indigo-500/20',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      icon: Layers,
      badge: 'Multi-Provider Cascade',
      title: 'Waterfall Email & Phone Enrichment',
      description:
        'Cascade through Hunter, Prospeo, and Dropcontact with real-time MX/SMTP ping verification. Achieve sub-2% bounce rates and direct-dial mobile phone numbers.',
      color: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      icon: PhoneCall,
      badge: 'Voice AI Revolution',
      title: 'Autonomous Voice SDR Caller',
      description:
        'Powered by Gemini Live 3.8 with sub-300ms ultra-low latency. Conducts natural outbound qualification calls, navigates phone trees, books calendar meetings, and transcribes responses directly into CRM.',
      color: 'from-amber-500/20 to-orange-500/20',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      icon: Zap,
      badge: 'Deep Technographics',
      title: 'Live Website Tech Stack Radar',
      description:
        'Inspect prospective websites on-the-fly for 1,200+ technologies: Shopify, Klaviyo, HubSpot, Salesforce, Next.js, Stripe, or Google Tag Manager. Filter leads by software they already pay for.',
      color: 'from-emerald-500/20 to-teal-500/20',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      icon: Laptop,
      badge: 'Zero-Cloud Markups',
      title: 'Hybrid Edge Desktop Worker',
      description:
        'Run browser scraping locally on your desktop machine or execute in our high-concurrency cloud. Unlimited scraping at zero cloud proxy cost with distributed desktop worker nodes.',
      color: 'from-cyan-500/20 to-sky-500/20',
      border: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Cpu,
      badge: 'Visual Automation',
      title: 'Drag-and-Drop DAG Pipelines',
      description:
        'Chain extractors, deduplicators, AI scoring filters, and multi-channel drip cadences with a node-based visual DAG builder. Automate your entire outbound engine end-to-end.',
      color: 'from-rose-500/20 to-red-500/20',
      border: 'border-rose-500/30',
      iconColor: 'text-rose-400',
    },
  ]

  return (
    <section id="features" className="py-24 relative z-10 border-t border-white/5 bg-neutral-950/60">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
            <span>Built For Modern Outbound Teams</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Everything You Need To Build A High-Velocity Pipeline
          </h2>
          <p className="text-neutral-400 text-base md:text-lg">
            Say goodbye to 5 disconnected tools. ApexLead consolidates live discovery, enrichment, verification, and outreach into one unified platform.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={i}
                className="group relative p-8 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${f.color} border ${f.border}`}>
                      <Icon className={`w-6 h-6 ${f.iconColor}`} />
                    </div>
                    <span className="text-xs font-medium text-neutral-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5">
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition">
                    {f.title}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {f.description}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-white/5 flex items-center text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition gap-1.5">
                  <span>Explore capability</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
