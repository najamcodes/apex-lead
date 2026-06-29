// src/screens/Review/KanbanColumn.tsx
import { Droppable } from '@hello-pangea/dnd'
import { LeadCard } from './LeadCard'
import type { Lead, LeadStatus } from '../../../shared/types'

interface KanbanColumnProps {
  id: LeadStatus
  title: string
  leads: Lead[]
  accent: string
  onCardClick: (lead: Lead) => void
}

export function KanbanColumn({ id, title, leads, accent, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${accent}`} />
          <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        </div>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Droppable list */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 min-h-[96px] rounded-xl p-2.5 space-y-3 transition-all duration-300
              ${snapshot.isDraggingOver ? 'bg-zinc-800/40 ring-1 ring-zinc-700/50' : 'bg-transparent border border-dashed border-zinc-800/50'}
            `}
          >
            {leads.map((lead, index) => (
              <LeadCard key={lead.id} lead={lead} index={index} onClick={onCardClick} />
            ))}
            {provided.placeholder}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
                Drop leads here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
