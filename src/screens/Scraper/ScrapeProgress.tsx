// src/screens/Scraper/ScrapeProgress.tsx
import { X, Loader2 } from 'lucide-react'
import { useScraperStore } from '../../store/scraper.store'

export function ScrapeProgress() {
  const { activeJobId, progress, cancelJob, pauseJob, resumeJob, cancelCsvQueue, csvQueue, csvIndex, csvFilename } = useScraperStore()
  if (!activeJobId || !progress) return null

  const isCsv = csvQueue.length > 0

  const pct = progress.total > 0 ? Math.round((progress.found / progress.total) * 100) : 0

  return (
    <div className="glass-panel border-emerald-500/20 rounded-xl p-5 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span className="text-sm font-medium text-slate-200">
            {progress.status === 'paused' 
              ? 'Scraping Paused' 
              : isCsv ? `Scraping CSV: ${csvFilename} (${csvIndex + 1}/${csvQueue.length})` : 'Scraping in progress'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {progress.status === 'paused' ? (
            <button
              onClick={() => resumeJob(activeJobId)}
              className="text-slate-500 hover:text-emerald-400 transition-colors p-1"
              title="Resume Job"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          ) : (
            <button
              onClick={() => pauseJob(activeJobId)}
              className="text-slate-500 hover:text-yellow-400 transition-colors p-1"
              title="Pause Job"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </button>
          )}
          <button
          onClick={() => {
            if (isCsv && confirm('Cancel the entire CSV batch?')) {
               cancelCsvQueue()
            } else if (!isCsv) {
              cancelJob(activeJobId)
            }
          }}
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
          title={isCsv ? "Cancel CSV Batch" : "Cancel Job"}
        >
          <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{progress.found} found</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Current business */}
      {progress.current_business && (
        <p className="text-xs text-slate-500 truncate">
          Last found: <span className="text-slate-300">{progress.current_business}</span>
        </p>
      )}
    </div>
  )
}
