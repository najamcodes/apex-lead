import { Check, X, Sparkles, HelpCircle } from 'lucide-react'

export function ComparisonSection() {
  const comparisonData = [
    {
      feature: 'Data Extraction Architecture',
      apex: 'Live On-Demand Scraper (Google Maps, YellowPages, Houzz, Yelp)',
      apollo: 'Static Scraped Database (6-18 mo old)',
      zoominfo: 'Static Scraped Database (6-12 mo old)',
      phantombuster: 'Script-based individual scrapers',
    },
    {
      feature: 'Email Deliverability Guarantee',
      apex: 'Sub-2% Bounces (Live MX/SMTP Ping + Waterfall)',
      apollo: '15-28% Bounce Rate (Stale contacts)',
      zoominfo: '10-20% Bounce Rate',
      phantombuster: 'No native verification',
    },
    {
      feature: 'Multi-Provider Waterfall Enrichment',
      apex: 'Hunter + Prospeo + Dropcontact Cascade',
      apollo: 'Single proprietary database',
      zoominfo: 'Single proprietary database',
      phantombuster: 'Requires 3rd party webhooks',
    },
    {
      feature: 'Autonomous Voice AI SDR Caller',
      apex: 'Built-in (Gemini Live 3.8 sub-300ms call agent)',
      apollo: 'Not available',
      zoominfo: 'Not available',
      phantombuster: 'Not available',
    },
    {
      feature: 'Local Desktop Edge Worker Mode',
      apex: 'Included ($0 Cloud Proxy markups)',
      apollo: 'Cloud-only credit burn',
      zoominfo: 'Cloud-only locked contract',
      phantombuster: 'Cloud execution hours limit',
    },
    {
      feature: 'Visual DAG Workflow Automation',
      apex: 'Drag & Drop Node Pipeline Graph',
      apollo: 'Linear sequences only',
      zoominfo: 'No workflow builder',
      phantombuster: 'Linear flow chains',
    },
    {
      feature: 'Contract Terms & Pricing',
      apex: 'From $29/mo • Cancel anytime via Polar',
      apollo: 'From $49/mo • Strict credit consumption',
      zoominfo: '$15,000+/yr • Multi-year lock-in',
      phantombuster: 'From $69/mo • Hard execution caps',
    },
  ]

  return (
    <section id="comparison" className="py-24 relative z-10 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Competitive Analysis</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Why High-Growth Teams Are Leaving Legacy Databases
          </h2>
          <p className="text-neutral-400 text-base md:text-lg">
            Compare ApexLead head-to-head against Apollo, ZoomInfo, and PhantomBuster.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="p-5 text-sm font-semibold text-neutral-300 w-1/4">Key Capability</th>
                <th className="p-5 text-sm font-bold text-indigo-400 bg-indigo-600/10 border-x border-indigo-500/30 w-1/4">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-white">ApexLead</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500 text-white">Live</span>
                  </div>
                </th>
                <th className="p-5 text-sm font-semibold text-neutral-400 w-1/6">Apollo.io</th>
                <th className="p-5 text-sm font-semibold text-neutral-400 w-1/6">ZoomInfo</th>
                <th className="p-5 text-sm font-semibold text-neutral-400 w-1/6">PhantomBuster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {comparisonData.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition">
                  <td className="p-5 font-medium text-neutral-300">{row.feature}</td>
                  <td className="p-5 font-semibold text-white bg-indigo-600/5 border-x border-indigo-500/20">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{row.apex}</span>
                    </div>
                  </td>
                  <td className="p-5 text-neutral-400">
                    <div className="flex items-start gap-2">
                      <X className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
                      <span>{row.apollo}</span>
                    </div>
                  </td>
                  <td className="p-5 text-neutral-400">
                    <div className="flex items-start gap-2">
                      <X className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
                      <span>{row.zoominfo}</span>
                    </div>
                  </td>
                  <td className="p-5 text-neutral-400">
                    <div className="flex items-start gap-2">
                      <X className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
                      <span>{row.phantombuster}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
