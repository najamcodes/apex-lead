// src/screens/Leads/LeadRow.tsx
import { ExternalLink, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { useLeadsStore } from '../../store/leads.store'
import type { Lead } from '../../types'

interface Props {
  lead: Lead
  selected: boolean
  onToggle: (id: number) => void
}

export function LeadRow({ lead, selected, onToggle }: Props) {
  const { updateStatus, deleteLead } = useLeadsStore()

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors group font-sans">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(lead.id)}
          className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary/20 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-zinc-200">{lead.business_name}</p>
        <p className="text-xs text-zinc-500">{lead.category}</p>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">{lead.city}</td>
      <td className="px-4 py-3">
        <Badge type="website_status" value={lead.website_status} />
      </td>
      <td className="px-4 py-3">
        <Badge type="lead_status" value={lead.status} />
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">
        {lead.phone ?? <span className="text-zinc-600">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          {lead.website_url && (
            <a
              href={lead.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {lead.status === 'review' && (
            <button
              onClick={() => updateStatus(lead.id, 'approved')}
              className="text-xs px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900 transition-colors"
            >
              Approve
            </button>
          )}
          <button
            onClick={() => deleteLead(lead.id)}
            className="text-zinc-650 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
