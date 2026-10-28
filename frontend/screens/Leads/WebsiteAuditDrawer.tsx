import { X, Activity, Server, ShieldCheck, ShieldAlert, Calendar, Layout, Zap, Search } from 'lucide-react'
import type { Lead } from '@sdk/core/types'

interface Props {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
}

export function WebsiteAuditDrawer({ lead, isOpen, onClose }: Props) {
  if (!isOpen || !lead) return null

  // Helper to determine color based on score (0-100)
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-zinc-500 bg-zinc-900 border-zinc-800'
    if (score >= 80) return 'text-emerald-400 bg-emerald-900/20 border-emerald-900/50'
    if (score >= 50) return 'text-amber-400 bg-amber-900/20 border-amber-900/50'
    return 'text-red-400 bg-red-900/20 border-red-900/50'
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className={`fixed right-0 top-0 bottom-0 w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 overflow-y-auto transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Website Audit
            </h2>
            <p className="text-sm text-zinc-400">{lead.business_name}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Main AI Score */}
          <div className="flex items-center justify-between p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-400">AI Quality Score</p>
              <p className="text-xs text-zinc-500">Based on modernity, performance & content</p>
            </div>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 text-xl font-bold ${getScoreColor(lead.ai_site_score)}`}>
              {lead.ai_site_score ?? '?'}
            </div>
          </div>

          {/* Technical Health */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-zinc-500" />
              Technical Health
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-zinc-400">Mobile Speed</span>
                </div>
                <p className={`text-lg font-medium ${lead.pagespeed_mobile ? (lead.pagespeed_mobile > 70 ? 'text-emerald-400' : 'text-amber-400') : 'text-zinc-600'}`}>
                  {lead.pagespeed_mobile ? `${lead.pagespeed_mobile}/100` : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Layout className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-zinc-400">Desktop Speed</span>
                </div>
                <p className={`text-lg font-medium ${lead.pagespeed_desktop ? (lead.pagespeed_desktop > 70 ? 'text-emerald-400' : 'text-amber-400') : 'text-zinc-600'}`}>
                  {lead.pagespeed_desktop ? `${lead.pagespeed_desktop}/100` : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {lead.ssl_valid ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-xs text-zinc-400">SSL Status</span>
                </div>
                <p className={`text-sm font-medium ${lead.ssl_valid ? 'text-emerald-400' : lead.ssl_valid === false ? 'text-red-400' : 'text-zinc-600'}`}>
                  {lead.ssl_valid ? 'Secure (Valid)' : lead.ssl_valid === false ? 'Insecure (Invalid)' : 'Unknown'}
                </p>
              </div>

              <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-zinc-400">Site Age</span>
                </div>
                <p className="text-sm font-medium text-zinc-200">
                  {lead.site_built_year ? `Est. ${lead.site_built_year}` : 'Unknown'}
                </p>
              </div>
            </div>
            
            {lead.seo_metrics && (
              <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-zinc-400">SEO & Accessibility Issues</span>
                </div>
                <p className="text-sm text-amber-400/90 whitespace-pre-wrap">{lead.seo_metrics}</p>
              </div>
            )}
            
            {lead.tech_stack && (
              <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">Detected Stack</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    try {
                      return JSON.parse(lead.tech_stack).map((tech: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-300 rounded">
                          {tech}
                        </span>
                      ))
                    } catch { return <span className="text-sm text-zinc-600">Error parsing stack</span> }
                  })()}
                </div>
              </div>
            )}
          </section>

          {/* AI Diagnosis & Pitch */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              AI Diagnosis & Pitch
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-lg">
                <h4 className="text-xs font-medium text-red-400 mb-2">The Problem (Site Summary)</h4>
                <p className="text-sm text-red-200/90 leading-relaxed">
                  {lead.ai_site_summary || "No AI summary generated yet. Run analysis to get insights."}
                </p>
              </div>

              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
                <h4 className="text-xs font-medium text-emerald-400 mb-2">The Pitch (How you can help)</h4>
                <p className="text-sm text-emerald-200/90 leading-relaxed whitespace-pre-wrap">
                  {lead.ai_service_pitch || "No AI service pitch generated yet. Run analysis to get insights."}
                </p>
              </div>

              <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-lg">
                <h4 className="text-xs font-medium text-blue-400 mb-2">Suggested Cold Email Hook</h4>
                <p className="text-sm text-blue-200/90 italic">
                  "{lead.ai_personalized_hook || "No AI hook generated yet."}"
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
