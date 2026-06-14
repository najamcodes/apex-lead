// src/components/layout/TopBar.tsx
import { useLocation } from 'react-router-dom'
import { Zap } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/scraper': 'Scraper',
  '/settings': 'Settings'
}

export function TopBar() {
  const { pathname } = useLocation()
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-zinc-950/60 backdrop-blur-md flex-shrink-0 font-sans sticky top-0 z-10">
      <h1 className="text-sm font-medium text-zinc-200 tracking-wide">{TITLES[pathname] ?? 'LeadHunter'}</h1>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Zap className="w-3.5 h-3.5 text-emerald-500" />
        <span>Ready</span>
      </div>
    </header>
  )
}
