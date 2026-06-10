// src/screens/Review/LeadCard.tsx
import { Draggable } from '@hello-pangea/dnd'
import { Globe, Phone, Zap } from 'lucide-react'
import type { Lead } from '../../types'

interface LeadCardProps {
  lead: Lead
  index: number
  onClick: (lead: Lead) => void
}

function ScoreDot({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-zinc-600">—</span>
  const color = score < 30 ? 'bg-red-500' : score < 60 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-zinc-400">{score}</span>
    </span>
  )
}

export function LeadCard({ lead, index, onClick }: LeadCardProps) {
  return (
    <Draggable draggableId={String(lead.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(lead)}
          className={`
            bg-zinc-800 border rounded-lg p-3.5 cursor-pointer
            transition-all duration-150 select-none
            ${snapshot.isDragging
              ? 'border-emerald-500/50 shadow-lg shadow-emerald-900/20 rotate-1'
              : 'border-zinc-700 hover:border-zinc-500'
            }
          `}
        >
          {/* Business name */}
          <p className="text-sm font-medium text-zinc-200 mb-1 leading-snug">
            {lead.business_name}
          </p>

          {/* Category + city */}
          <p className="text-xs text-zinc-500 mb-3">
            {lead.category} · {lead.city}
          </p>

          {/* AI summary */}
          {lead.ai_site_summary && (
            <p className="text-xs text-zinc-400 mb-3 line-clamp-2 leading-relaxed">
              {lead.ai_site_summary}
            </p>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScoreDot score={lead.ai_site_score} />
              {lead.website_url ? (
                <Globe className="w-3 h-3 text-zinc-500" />
              ) : (
                <span className="text-xs text-red-400">No site</span>
              )}
              {lead.phone && <Phone className="w-3 h-3 text-zinc-500" />}
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              {lead.pagespeed_mobile !== null && (
                <span className="flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />
                  {lead.pagespeed_mobile}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}
