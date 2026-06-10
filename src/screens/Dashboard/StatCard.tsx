// src/screens/Dashboard/StatCard.tsx
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  accent?: string
}

export function StatCard({ label, value, icon: Icon, accent = 'text-zinc-400' }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 font-sans">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <p className={`text-3xl font-semibold ${accent}`}>{value.toLocaleString()}</p>
    </div>
  )
}
