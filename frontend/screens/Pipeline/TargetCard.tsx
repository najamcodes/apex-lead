// src/screens/Pipeline/TargetCard.tsx
import { Pause, Play, Trash2, MapPin, Search, Star, Globe } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import type { ScrapeTarget } from '../../../shared/types/pipeline.types'

interface TargetCardProps {
  target:   ScrapeTarget
  onToggle: () => void
  onDelete: () => void
}

export function TargetCard({ target, onToggle, onDelete }: TargetCardProps) {
  const isActive = target.status === 'active'

  return (
    <div className={`bg-zinc-900/60 backdrop-blur-sm border rounded-xl px-5 py-4 flex items-center gap-4 transition-colors duration-200 ${
      isActive ? 'border-zinc-700/80 hover:border-zinc-600' : 'border-zinc-800/50 opacity-70'
    }`}>
      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-zinc-600'
      }`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-100">{target.label}</p>
          {target.website_filter !== 'all' && (
            <Badge
              type="website_status"
              value={target.website_filter === 'none_only' ? 'none' : 'outdated'}
            />
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-zinc-400" /> {target.query}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {target.city}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-zinc-400" /> max {target.max_per_run}/night
          </span>
          {target.min_ai_score > 0 && (
            <span className="flex items-center gap-1 text-emerald-500/80">
              <Star className="w-3.5 h-3.5" /> score ≥ {target.min_ai_score}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right flex-shrink-0 pr-4 border-r border-zinc-800">
        <p className="text-sm font-semibold text-zinc-200">{target.total_found.toLocaleString()}</p>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Found</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pl-2 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={onToggle}
          title={isActive ? 'Pause target' : 'Resume target'}
          className={isActive ? 'hover:text-amber-400 hover:bg-amber-400/10 px-2' : 'hover:text-emerald-400 hover:bg-emerald-400/10 px-2'}
        >
          {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Delete this target permanently?')) onDelete()
          }}
          className="hover:text-red-400 hover:bg-red-400/10 px-2"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
