// src/screens/Dashboard/StatCard.tsx
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  accent?: string
  onClick?: () => void
}

export function StatCard({ label, value, icon: Icon, accent = 'text-zinc-400', onClick }: StatCardProps) {
  return (
    <div 
      className={`bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 rounded-xl p-5 font-sans transition-all duration-300 ease-out group ${onClick ? 'cursor-pointer hover:bg-zinc-800/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-zinc-700/80' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${accent}`} />
      </div>
      <p className={`text-3xl font-semibold tracking-tight ${accent}`}>{value.toLocaleString()}</p>
    </div>
  )
}
