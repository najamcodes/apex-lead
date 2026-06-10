// src/screens/Scraper/ScrapeProgress.tsx
import { X, Loader2 } from 'lucide-react'
import { useScraperStore } from '../../store/scraper.store'

export function ScrapeProgress() {
  const { activeJobId, progress, cancelJob } = useScraperStore()
  if (!activeJobId || !progress) return null

  const pct = progress.total > 0
    ? Math.round((progress.found / progress.total) * 100)
    : 0

  return (
    <div className="bg-zinc-900 border border-emerald-800/50 rounded-xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">Scraping in progress</span>
        </div>
        <button
          onClick={() => cancelJob(activeJobId)}
          className="text-zinc-500 hover:text-red-400 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
          <span>{progress.found} found</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Current business */}
      {progress.current_business && (
        <p className="text-xs text-zinc-500 truncate">
          Last found: <span className="text-zinc-300">{progress.current_business}</span>
        </p>
      )}
    </div>
  )
}
