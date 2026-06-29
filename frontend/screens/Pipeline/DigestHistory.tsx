// src/screens/Pipeline/DigestHistory.tsx
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import type { DigestRun } from '../../../shared/types/pipeline.types'

interface DigestHistoryProps {
  digests: DigestRun[]
}

export function DigestHistory({ digests }: DigestHistoryProps) {
  if (digests.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
        <p className="text-sm text-zinc-400">No digest history yet.</p>
        <p className="text-xs text-zinc-600 mt-1">The pipeline will run automatically tonight.</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-zinc-900/50 text-zinc-500 text-xs uppercase tracking-wider font-medium">
          <tr>
            <th className="px-5 py-3 border-b border-zinc-800/50">Run Date</th>
            <th className="px-5 py-3 border-b border-zinc-800/50">Targets</th>
            <th className="px-5 py-3 border-b border-zinc-800/50">Scraped</th>
            <th className="px-5 py-3 border-b border-zinc-800/50">New Leads</th>
            <th className="px-5 py-3 border-b border-zinc-800/50">Qualified</th>
            <th className="px-5 py-3 border-b border-zinc-800/50 text-center">Email Sent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
          {digests.map((run) => (
            <tr key={run.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-5 py-3.5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {new Date(run.run_at).toLocaleString()}
              </td>
              <td className="px-5 py-3.5 text-zinc-400">{run.targets_run}</td>
              <td className="px-5 py-3.5">{run.total_scraped.toLocaleString()}</td>
              <td className="px-5 py-3.5 font-medium text-emerald-400">{run.total_new.toLocaleString()}</td>
              <td className="px-5 py-3.5">{run.total_qualified.toLocaleString()}</td>
              <td className="px-5 py-3.5 text-center">
                {run.digest_sent ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 inline-block" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 inline-block" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
