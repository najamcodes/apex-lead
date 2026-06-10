// src/screens/Scraper/ScrapeHistory.tsx
import { useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { useScraperStore } from '../../store/scraper.store'
import type { ScrapeStatus } from '../../types/scraper.types'

const STATUS_ICON: Record<ScrapeStatus, React.ReactNode> = {
  completed:  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  failed:     <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  cancelled:  <XCircle className="w-3.5 h-3.5 text-zinc-500" />,
  running:    <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />,
  idle:       <Clock className="w-3.5 h-3.5 text-zinc-650" />,
  paused:     <Clock className="w-3.5 h-3.5 text-amber-400" />,
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const secs = Math.round((e.getTime() - s.getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

export function ScrapeHistory() {
  const { jobs, fetchJobs } = useScraperStore()

  useEffect(() => {
    fetchJobs()
  }, [])

  if (jobs.length === 0) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden font-sans">
      <div className="px-5 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-300">Recent runs</h3>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/20">
            {['', 'Query', 'City', 'Found', 'Duration', 'Status'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-zinc-805 hover:bg-zinc-800/20 transition-colors">
              <td className="px-4 py-3">{STATUS_ICON[job.status]}</td>
              <td className="px-4 py-3 text-sm text-zinc-300 capitalize">{job.query}</td>
              <td className="px-4 py-3 text-sm text-zinc-400">{job.city}</td>
              <td className="px-4 py-3 text-sm text-emerald-400 font-medium">{job.found}</td>
              <td className="px-4 py-3 text-sm text-zinc-500">
                {formatDuration(job.started_at, job.completed_at)}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500 capitalize">{job.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
