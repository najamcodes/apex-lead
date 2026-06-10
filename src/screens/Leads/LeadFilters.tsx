// src/screens/Leads/LeadFilters.tsx
import { Search } from 'lucide-react'
import { useLeadsStore } from '../../store/leads.store'
import type { LeadFilters as Filters } from '../../types'

export function LeadFilters() {
  const { filters, setFilters } = useLeadsStore()

  const update = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })

  return (
    <div className="flex items-center gap-3 font-sans">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          placeholder="Search leads..."
          value={filters.search ?? ''}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 rounded-md text-sm bg-zinc-850 border border-zinc-750
            text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500
            focus:ring-1 focus:ring-emerald-500/30 transition-colors"
        />
      </div>

      <select
        value={filters.status ?? 'all'}
        onChange={(e) => update({ status: e.target.value as Filters['status'] })}
        className="px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700
          text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
      >
        <option value="all">All statuses</option>
        <option value="scraped">Scraped</option>
        <option value="review">In Review</option>
        <option value="approved">Approved</option>
        <option value="outreach">Outreach</option>
        <option value="closed">Closed</option>
        <option value="skipped">Skipped</option>
      </select>

      <select
        value={filters.website_status ?? 'all'}
        onChange={(e) => update({ website_status: e.target.value as Filters['website_status'] })}
        className="px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700
          text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
      >
        <option value="all">All sites</option>
        <option value="none">No website</option>
        <option value="outdated">Outdated</option>
        <option value="modern">Modern</option>
        <option value="unchecked">Unchecked</option>
      </select>
    </div>
  )
}
