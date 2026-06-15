import { Play, Pause, Trash2, Bot } from 'lucide-react'
import type { QueryProfile } from '../../types/pipeline.types'

interface Props {
  profile: QueryProfile
  onToggleStatus: (id: number, currentStatus: string) => void
  onDelete: (id: number) => void
}

export function QueryProfileCard({ profile, onToggleStatus, onDelete }: Props) {
  const isActive = profile.status === 'active'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-zinc-100 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            {profile.label}
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Generates smart queries based on profile parameters.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleStatus(profile.id, profile.status)}
            className={`p-1.5 rounded-md transition-colors ${
              isActive ? 'text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20' : 'text-zinc-400 bg-zinc-800 hover:bg-zinc-700'
            }`}
            title={isActive ? 'Pause profile' : 'Activate profile'}
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(profile.id)}
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
            title="Delete profile"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mt-4 text-sm text-zinc-300">
        <div className="flex items-start justify-between">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">Audience</span>
          <span className="text-right max-w-[200px] truncate">{profile.target_audience}</span>
        </div>
        <div className="flex items-start justify-between">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">Offer</span>
          <span className="text-right max-w-[200px] truncate">{profile.core_offer}</span>
        </div>
        <div className="flex items-start justify-between">
          <span className="text-zinc-500 text-xs uppercase tracking-wider">Locations</span>
          <span className="text-right max-w-[200px] truncate">
            {(() => {
              try { return JSON.parse(profile.cities).join(', ') }
              catch { return 'Unknown' }
            })()}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between items-center text-xs">
        <span className="text-zinc-500">Queries Generated</span>
        <span className="font-medium text-emerald-400">{profile.queries_generated}</span>
      </div>
    </div>
  )
}
