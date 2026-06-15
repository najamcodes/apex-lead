// src/screens/Scraper/index.tsx
import { useEffect } from 'react'
import { ScrapeForm } from './ScrapeForm'
import { ScrapeProgress } from './ScrapeProgress'
import { ScrapeHistory } from './ScrapeHistory'
import { useScraperStore } from '../../store/scraper.store'

export function Scraper() {
  const { setProgress } = useScraperStore()

  // Subscribe to real-time progress from main process
  useEffect(() => {
    const cleanup = window.api.scraper.onProgress(setProgress)
    return cleanup
  }, [setProgress])

  return (
    <div className="space-y-6 max-w-2xl font-sans">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Scraper</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Find businesses with no website or outdated sites
        </p>
      </div>
      <ScrapeProgress />
      <ScrapeForm />
      <ScrapeHistory />
    </div>
  )
}
