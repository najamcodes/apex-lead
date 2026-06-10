// src/components/ui/Badge.tsx
import type { LeadStatus, WebsiteStatus } from '../../types'

const STATUS_STYLES: Record<LeadStatus, string> = {
  scraped:     'bg-zinc-800 text-zinc-300',
  qualified:   'bg-blue-900/50 text-blue-300',
  review:      'bg-amber-900/50 text-amber-300',
  approved:    'bg-emerald-900/50 text-emerald-300',
  outreach:    'bg-purple-900/50 text-purple-300',
  replied:     'bg-cyan-900/50 text-cyan-300',
  closed:      'bg-green-900/60 text-green-200',
  skipped:     'bg-zinc-900 text-zinc-500',
  unsubscribed:'bg-red-900/40 text-red-400',
}

const WEBSITE_STATUS_STYLES: Record<WebsiteStatus, string> = {
  none:      'bg-red-900/50 text-red-300',
  outdated:  'bg-amber-900/50 text-amber-300',
  modern:    'bg-emerald-900/50 text-emerald-300',
  unchecked: 'bg-zinc-800 text-zinc-400',
}

interface BadgeProps {
  type: 'lead_status' | 'website_status'
  value: LeadStatus | WebsiteStatus
}

export function Badge({ type, value }: BadgeProps) {
  const style = type === 'lead_status'
    ? STATUS_STYLES[value as LeadStatus]
    : WEBSITE_STATUS_STYLES[value as WebsiteStatus]

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {value.replace('_', ' ')}
    </span>
  )
}
