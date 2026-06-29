// src/components/ui/Badge.tsx
import type { LeadStatus, WebsiteStatus } from '../../../shared/types'

const STATUS_STYLES: Record<LeadStatus, string> = {
  scraped: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50',
  qualified: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm shadow-emerald-500/10',
  outreach: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  replied: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  closed: 'bg-green-500/10 text-green-400 border-green-500/20 shadow-sm shadow-green-500/10',
  skipped: 'bg-zinc-900/80 text-zinc-500 border-zinc-800',
  unsubscribed: 'bg-red-500/10 text-red-400 border-red-500/20'
}

const WEBSITE_STATUS_STYLES: Record<WebsiteStatus, string> = {
  none: 'bg-red-500/10 text-red-400 border-red-500/20',
  outdated: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  modern: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  unchecked: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
}

interface BadgeProps {
  type: 'lead_status' | 'website_status'
  value: LeadStatus | WebsiteStatus
}

export function Badge({ type, value }: BadgeProps) {
  const style =
    type === 'lead_status'
      ? STATUS_STYLES[value as LeadStatus]
      : WEBSITE_STATUS_STYLES[value as WebsiteStatus]

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium backdrop-blur-sm ${style}`}>
      {value.replace('_', ' ')}
    </span>
  )
}
