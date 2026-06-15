// src/screens/Dashboard/StatCard.tsx
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  accent?: string
  onClick?: () => void
}

export function StatCard({ label, value, icon: Icon, accent = 'text-zinc-400', onClick }: StatCardProps) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      className={`glass-panel p-5 rounded-xl font-sans transition-all duration-300 ease-out group ${onClick ? 'cursor-pointer hover:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-slate-700/80' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${accent}`} />
      </div>
      <p className={`text-3xl font-semibold tracking-tight ${accent}`}>{value.toLocaleString()}</p>
    </motion.div>
  )
}
