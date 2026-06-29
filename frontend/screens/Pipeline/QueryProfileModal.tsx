import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { QueryProfileInsert } from '../../../shared/types/pipeline.types'

interface Props {
  onClose: () => void
  onSave: (data: QueryProfileInsert) => Promise<void>
}

export function QueryProfileModal({ onClose, onSave }: Props) {
  const [label, setLabel] = useState('')
  const [audience, setAudience] = useState('')
  const [offer, setOffer] = useState('')
  const [cities, setCities] = useState('')
  const [countries, setCountries] = useState('United States')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        label,
        target_audience: audience,
        core_offer: offer,
        cities: cities.split(',').map((c) => c.trim()).filter(Boolean),
        countries: countries.split(',').map((c) => c.trim()).filter(Boolean),
      })
      onClose()
    } catch (err) {
      console.error('Failed to save profile:', err)
      alert('Failed to save profile. See console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Add Smart Query Profile</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Profile Name</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. B2B Professional Services"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Target Audience</label>
            <input
              required
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Lawyers, Dentists, Accountants"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Core Offer / Niche</label>
            <input
              required
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="e.g. SEO Services, Web Design"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Cities (comma separated)</label>
            <input
              required
              value={cities}
              onChange={(e) => setCities(e.target.value)}
              placeholder="e.g. London, Manchester, Birmingham"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Countries (comma separated)</label>
            <input
              required
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="e.g. United States"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
