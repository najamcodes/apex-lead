import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import {
  TrendingUp,
  Users,
  Mail,
  MessageSquare,
  Building,
  MapPin,
  RefreshCw,
  Zap,
  Target,
  PieChart as PieChartIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

export function AnalyticsDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.analytics.getRoi()
      setData(res)
    } catch (err: any) {
      toast.error(`Failed to load analytics: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !data) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading ROI & Conversion Intelligence...</span>
        </div>
      </div>
    )
  }

  const { funnel, metrics, topCategories, topCities, sources } = data

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/40">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              ROI & Campaign Conversion Tracker
            </h1>
            <p className="text-xs text-slate-400">
              End-to-end acquisition funnel metrics, lead qualification rates, and outbound ROI breakdown.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Scraped Leads</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metrics.totalLeads.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{metrics.pipelineRunsTotal}</span> pipeline runs executed
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">AI Qualified Rate</span>
              <Target className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-300 font-mono">{metrics.qualifiedRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Scored $\ge 50$ or high ICP potential
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Email Discovery Rate</span>
              <Mail className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-300 font-mono">{metrics.emailDiscoveryRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Enriched with verified business email
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Campaign Reply Rate</span>
              <MessageSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">{metrics.replyRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {metrics.outreachSent} total emails sent ({metrics.openRate}% opened)
            </div>
          </div>
        </div>

        {/* Full-Funnel Conversion Visualizer */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Pipeline Conversion Funnel
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Conversion and drop-off rate from raw scrape down to meeting reply.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {funnel.map((step: any, idx: number) => (
              <div key={step.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-slate-200">{step.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-300 font-bold">{step.count.toLocaleString()}</span>
                    <span className="text-slate-500 text-[11px]">({step.percentage}%)</span>
                    {step.dropoffRate > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 border border-red-800/40 text-red-400">
                        -{step.dropoffRate}% drop
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, step.percentage)}%`,
                      backgroundColor: step.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Categories */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Building className="w-4 h-4 text-emerald-400" />
              Top Industries & Qualification
            </h3>
            <div className="space-y-3">
              {topCategories.map((c: any) => (
                <div key={c.category} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">{c.category}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      {c.qualified} qualified ({c.total > 0 ? Math.round((c.qualified / c.total) * 100) : 0}%) • {c.emailFound} emails found
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-200 font-mono">{c.total}</span>
                    <div className="text-[10px] text-slate-500">leads</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Cities */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-blue-400" />
              Top Geographic Locations
            </h3>
            <div className="space-y-3">
              {topCities.map((city: any) => (
                <div key={city.city} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">{city.city}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      {city.qualified} qualified • {city.emailFound} emails found
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-200 font-mono">{city.total}</span>
                    <div className="text-[10px] text-slate-500">leads</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <PieChartIcon className="w-4 h-4 text-purple-400" />
            Lead Acquisition Channels
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sources.map((s: any) => (
              <div key={s.source} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">{s.source}</span>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">{s.percentage}% of total fleet</div>
                </div>
                <div className="text-xl font-bold text-emerald-400 font-mono">{s.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default AnalyticsDashboard
