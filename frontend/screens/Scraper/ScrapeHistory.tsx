// src/screens/Scraper/ScrapeHistory.tsx
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, Trash2, RefreshCw } from 'lucide-react'
import { useScraperStore } from '../../store/scraper.store'
import { Pagination } from '../../components/ui/Pagination'
import type { ScrapeStatus } from '@sdk/core/types'

const STATUS_ICON: Record<ScrapeStatus, React.ReactNode> = {
  completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  failed: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  cancelled: <XCircle className="w-3.5 h-3.5 text-zinc-500" />,
  running: <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />,
  idle: <Clock className="w-3.5 h-3.5 text-zinc-650" />,
  paused: <Clock className="w-3.5 h-3.5 text-amber-400" />
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
  const { jobs, fetchJobs, deleteJob, deleteJobs, startJob, loading } = useScraperStore()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchJobs()
  }, [])

  if (jobs.length === 0) return null

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === jobs.length) setSelected(new Set())
    else setSelected(new Set(jobs.map((j) => j.id)))
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    if (confirm(`Are you sure you want to delete ${selected.size} jobs?`)) {
      await deleteJobs(Array.from(selected))
      setSelected(new Set())
    }
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden font-sans">
      <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-sm font-medium text-slate-300">Recent runs</h3>
        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected ({selected.size})
          </button>
        )}
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/5 bg-slate-900/40 backdrop-blur-sm">
            <th className="px-4 py-2.5 w-10 text-center">
              <input
                type="checkbox"
                className="rounded border-slate-700 bg-slate-800/50 text-emerald-500 focus:ring-emerald-500/20"
                checked={jobs.length > 0 && selected.size === jobs.length}
                onChange={toggleAll}
              />
            </th>
            {['', 'Date', 'Query', 'City', 'Found', 'Duration', 'Status', ''].map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className={`group border-b border-white/5 transition-colors ${selected.has(job.id) ? 'bg-emerald-900/20 hover:bg-emerald-900/30' : 'hover:bg-slate-800/40'}`}
            >
              <td className="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-700 bg-slate-800/50 text-emerald-500 focus:ring-emerald-500/20"
                  checked={selected.has(job.id)}
                  onChange={() => toggleSelect(job.id)}
                />
              </td>
              <td className="px-4 py-3">{STATUS_ICON[job.status]}</td>
              <td className="px-4 py-3 text-sm text-slate-400">
                {job.started_at ? new Date(job.started_at).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-slate-200 capitalize">{job.query}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{job.city}</td>
              <td className="px-4 py-3 text-sm text-emerald-400 font-medium">{job.found}</td>
              <td className="px-4 py-3 text-sm text-slate-400">
                {formatDuration(job.started_at, job.completed_at)}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 capitalize">{job.status}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      if (!loading) {
                        startJob({
                          query: job.query,
                          city: job.city,
                          country: job.country,
                          max_results: job.max_results,
                          use_proxy: false
                        })
                      }
                    }}
                    disabled={loading}
                    title="Re-run this job"
                    className="text-slate-500 hover:text-emerald-400 transition-colors p-1 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteJob(job.id)}
                    title="Delete job"
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={useScraperStore.getState().page}
        pageSize={useScraperStore.getState().pageSize}
        total={useScraperStore.getState().total}
        onPageChange={(page) => useScraperStore.getState().setPagination(page)}
        onPageSizeChange={(pageSize) => useScraperStore.getState().setPagination(1, pageSize)}
      />
    </div>
  )
}
