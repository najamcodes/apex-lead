'use client';
// src/components/layout/TopBar.tsx
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Zap, Server, RefreshCw } from 'lucide-react'
import { useServerConfigStore } from '../../store/server-config.store'
import { ServerConfigModal } from '../common/ServerConfigModal'

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/scraper': 'Scraper',
  '/settings': 'Settings'
}

export function TopBar() {
  const { pathname } = useLocation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { init, serverUrl, healthStatus, latencyMs } = useServerConfigStore()

  useEffect(() => {
    init()
  }, [init])

  // Shorten url for display (e.g. "localhost:4000" or "api.acme.com")
  const displayHost = (() => {
    try {
      const u = new URL(serverUrl)
      return u.host
    } catch {
      return serverUrl.replace(/^https?:\/\//, '')
    }
  })()

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-transparent backdrop-blur-xl flex-shrink-0 font-sans sticky top-0 z-20">
        <h1 className="text-sm font-medium text-slate-200 tracking-wide">{TITLES[pathname] ?? 'ApexLead'}</h1>
        
        <div className="flex items-center gap-3">
          {/* Backend Server Status & Quick Config Pill */}
          <button
            onClick={() => setIsModalOpen(true)}
            title={`Backend: ${serverUrl} (Click to configure)`}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono transition-all border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700 text-zinc-300"
          >
            <Server className="w-3 h-3 text-zinc-400" />
            <span className="truncate max-w-[140px] text-[11px]">{displayHost}</span>

            {healthStatus === 'healthy' && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {latencyMs != null && <span className="opacity-80">{latencyMs}ms</span>}
              </span>
            )}

            {healthStatus === 'checking' && (
              <RefreshCw className="w-2.5 h-2.5 text-amber-400 animate-spin" />
            )}

            {healthStatus === 'unhealthy' && (
              <span className="flex items-center gap-1 text-[11px] text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>down</span>
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 text-xs text-zinc-500 pl-1 border-l border-white/10">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ready</span>
          </div>
        </div>
      </header>

      <ServerConfigModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
