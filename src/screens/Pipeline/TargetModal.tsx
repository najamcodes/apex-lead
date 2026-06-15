// src/screens/Pipeline/TargetModal.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { ScrapeTargetInsert } from '../../types/pipeline.types'

interface TargetModalProps {
  onClose: () => void
  onSave: (data: ScrapeTargetInsert) => Promise<void>
}

export function TargetModal({ onClose, onSave }: TargetModalProps) {
  const [form, setForm] = useState<ScrapeTargetInsert>({
    label: '',
    query: '',
    city: '',
    country: 'Pakistan',
    max_per_run: 50,
    min_ai_score: 0,
    website_filter: 'all',
    use_proxy: false
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/50">
          <h2 className="text-base font-semibold text-zinc-100">Add Scrape Target</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col p-6 space-y-4">
          <Input
            label="Friendly Label"
            placeholder="e.g. Karachi Restaurants"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Search Query"
              placeholder="e.g. restaurants"
              value={form.query}
              onChange={(e) => setForm({ ...form, query: e.target.value })}
              required
            />
            <Input
              label="City"
              placeholder="e.g. Karachi"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max Leads / Night"
              type="number"
              min="1"
              max="500"
              value={form.max_per_run}
              onChange={(e) => setForm({ ...form, max_per_run: parseInt(e.target.value) || 0 })}
              required
            />
            <Input
              label="Min AI Score (0 = all)"
              type="number"
              min="0"
              max="100"
              value={form.min_ai_score}
              onChange={(e) => setForm({ ...form, min_ai_score: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <label className="text-xs font-medium text-zinc-400">Website Filter</label>
            <select
              className="w-full px-3 py-2 rounded-md text-sm bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 text-zinc-100 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              value={form.website_filter}
              onChange={(e) => setForm({ ...form, website_filter: e.target.value as any })}
            >
              <option value="all">Keep all leads</option>
              <option value="none_only">Only leads without a website</option>
              <option value="outdated_only">Only leads with outdated websites</option>
            </select>
          </div>

          <label className="flex items-center gap-2 pt-2 cursor-pointer group w-fit">
            <input
              type="checkbox"
              className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/20"
              checked={form.use_proxy}
              onChange={(e) => setForm({ ...form, use_proxy: e.target.checked })}
            />
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
              Use residential proxies (slower, safer)
            </span>
          </label>

          {/* Footer actions */}
          <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-zinc-800/50">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Save Target
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
