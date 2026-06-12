// src/screens/Scraper/ScrapeForm.tsx
import { useState } from 'react'
import Papa from 'papaparse'
import { Play, Upload } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useScraperStore } from '../../store/scraper.store'
import { useSettingsStore } from '../../store/settings.store'
import type { ScrapeJobConfig } from '../../types/scraper.types'

const QUICK_QUERIES = [
  'restaurants',
  'hair salons',
  'dental clinics',
  'law firms',
  'auto repair shops',
  'real estate agents',
  'gyms',
  'pharmacies',
  'clothing stores',
  'hotels'
]

export function ScrapeForm() {
  const { startJob, loading, activeJobId } = useScraperStore()
  const { settings } = useSettingsStore()
  const isRunning = !!activeJobId

  const [form, setForm] = useState<ScrapeJobConfig>({
    query: '',
    city: settings?.default_city || '',
    country: settings?.default_country || 'Pakistan',
    max_results: settings?.max_results_per_run || 50,
    use_proxy: false
  })

  const set = (patch: Partial<ScrapeJobConfig>) => setForm((f) => ({ ...f, ...patch }))

  const handleStart = async () => {
    if (!form.query || !form.city) return
    await startJob(form)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const queue: ScrapeJobConfig[] = results.data
          .map((row: any) => ({
            query: row.query || '',
            city: row.city || '',
            country: row.country || form.country,
            max_results: parseInt(row.max_results) || form.max_results,
            use_proxy: form.use_proxy,
            website_filter: row.website_filter || form.website_filter,
            phone_filter: row.phone_filter || form.phone_filter,
            email_filter: row.email_filter || form.email_filter
          }))
          .filter((q) => q.query && q.city)

        if (queue.length > 0) {
          useScraperStore.getState().startCsvQueue(file.name, queue)
        } else {
          alert('No valid rows found. Ensure CSV has "query" and "city" columns.')
        }

        // Reset input
        e.target.value = ''
      }
    })
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5 font-sans">
      <h3 className="text-sm font-medium text-zinc-300">New scrape run</h3>

      {/* Quick query chips */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Quick select</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => set({ query: q })}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                form.query === q
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Business type / query"
          placeholder="e.g. hair salons"
          value={form.query}
          onChange={(e) => set({ query: e.target.value })}
        />
        <Input
          label="City"
          placeholder="e.g. Rawalpindi"
          value={form.city}
          onChange={(e) => set({ city: e.target.value })}
        />
        <Input
          label="Country"
          placeholder="e.g. Pakistan"
          value={form.country}
          onChange={(e) => set({ country: e.target.value })}
        />
        <Input
          label="Max results"
          type="number"
          value={form.max_results}
          onChange={(e) => set({ max_results: parseInt(e.target.value) || 50 })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">Website Filter</label>
          <select
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
            value={form.website_filter || 'all'}
            onChange={(e) => set({ website_filter: e.target.value as any })}
          >
            <option value="all">Any</option>
            <option value="required">Must have website</option>
            <option value="none">Must NOT have website</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">Phone Filter</label>
          <select
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
            value={form.phone_filter || 'all'}
            onChange={(e) => set({ phone_filter: e.target.value as any })}
          >
            <option value="all">Any</option>
            <option value="required">Must have phone</option>
            <option value="none">Must NOT have phone</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">Email Filter</label>
          <select
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
            value={form.email_filter || 'all'}
            onChange={(e) => set({ email_filter: e.target.value as any })}
          >
            <option value="all">Any</option>
            <option value="required">Must have email</option>
            <option value="none">Must NOT have email</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="use_proxy"
          checked={form.use_proxy}
          onChange={(e) => set({ use_proxy: e.target.checked })}
          className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
        />
        <label htmlFor="use_proxy" className="text-sm text-zinc-400">
          Use proxy (configure in Settings)
        </label>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={handleStart}
          loading={loading && !useScraperStore.getState().csvQueue.length}
          disabled={isRunning || !form.query || !form.city}
          className="flex-1 justify-center"
        >
          <Play className="w-3.5 h-3.5" />
          {isRunning && !useScraperStore.getState().csvQueue.length ? 'Running…' : 'Start scrape'}
        </Button>
        <div className="relative flex-1">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isRunning}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <Button
            variant="secondary"
            disabled={isRunning}
            className="w-full justify-center pointer-events-none"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV Batch
          </Button>
        </div>
      </div>
    </div>
  )
}
