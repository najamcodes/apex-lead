// frontend/screens/Leads/AddLeadModal.tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, Plus, FileText, CheckCircle, AlertCircle, Building2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useLeadsStore } from '../../store/leads.store'
import type { LeadInsert } from '../../../shared/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
}

export function AddLeadModal({ isOpen, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Manual form state
  const [manualData, setManualData] = useState<Partial<LeadInsert>>({
    business_name: '',
    category: '',
    city: '',
    country: 'US',
    email: '',
    phone: '',
    website_url: '',
    source: 'manual',
  })

  // CSV State
  const [csvText, setCsvText] = useState('')
  const [parsedLeads, setParsedLeads] = useState<LeadInsert[]>([])

  const { addLead, importBatch } = useLeadsStore()

  if (!isOpen) return null

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualData.business_name?.trim()) {
      setError('Business name is required')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await addLead(manualData as LeadInsert)
      onSuccess(1)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to create lead')
    } finally {
      setLoading(false)
    }
  }

  const parseCsvContent = (content: string) => {
    try {
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)
      if (lines.length < 2) {
        setParsedLeads([])
        return
      }

      // Simple CSV header parse handling quotes
      const splitRow = (row: string) => {
        const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []
        return matches.map(m => m.replace(/^"|"$/g, '').trim())
      }

      const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
      
      const leads: LeadInsert[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = splitRow(lines[i])
        if (values.length === 0) continue

        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx] || ''
        })

        const business_name = row.business_name || row.name || row.company || row.business || row.title
        if (!business_name) continue

        leads.push({
          business_name,
          category: row.category || row.industry || '',
          city: row.city || row.location || '',
          country: row.country || 'US',
          email: row.email || null,
          phone: row.phone || row.telephone || null,
          website_url: row.website_url || row.website || row.url || null,
          source: 'csv_import',
        })
      }

      setParsedLeads(leads)
    } catch (err: any) {
      setError('Failed to parse CSV format')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      parseCsvContent(text)
    }
    reader.readAsText(file)
  }

  const handleCsvSubmit = async () => {
    if (parsedLeads.length === 0) {
      setError('No valid lead records parsed from CSV')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await importBatch(parsedLeads)
      onSuccess(res.imported)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to import CSV records')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Add New Leads</h3>
              <p className="text-xs text-zinc-400">Manual single entry or bulk CSV spreadsheet import</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800 px-6 pt-2 bg-zinc-950/40">
          <button
            onClick={() => { setTab('manual'); setError(null) }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'manual'
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            onClick={() => { setTab('csv'); setError(null) }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'csv'
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            CSV Import {parsedLeads.length > 0 && `(${parsedLeads.length})`}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Business Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={manualData.business_name}
                  onChange={(e) => setManualData({ ...manualData, business_name: e.target.value })}
                  placeholder="Acme Growth Inc."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category / Industry</label>
                  <Input
                    value={manualData.category}
                    onChange={(e) => setManualData({ ...manualData, category: e.target.value })}
                    placeholder="SaaS / Marketing"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">City</label>
                  <Input
                    value={manualData.city}
                    onChange={(e) => setManualData({ ...manualData, city: e.target.value })}
                    placeholder="San Francisco"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                  <Input
                    type="email"
                    value={manualData.email || ''}
                    onChange={(e) => setManualData({ ...manualData, email: e.target.value })}
                    placeholder="founder@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Phone Number</label>
                  <Input
                    value={manualData.phone || ''}
                    onChange={(e) => setManualData({ ...manualData, phone: e.target.value })}
                    placeholder="+1 (555) 019-2834"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Website URL</label>
                <Input
                  value={manualData.website_url || ''}
                  onChange={(e) => setManualData({ ...manualData, website_url: e.target.value })}
                  placeholder="https://acme.com"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-zinc-800">
                <Button variant="ghost" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={loading}>
                  Save Lead
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-zinc-700/80 hover:border-primary/60 rounded-2xl p-6 text-center transition-colors">
                <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-zinc-200">Drop your CSV file here, or click to browse</p>
                <p className="text-xs text-zinc-500 mt-1">Accepts columns: name, email, phone, city, category, website</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="mt-3 block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Or paste raw CSV text:</label>
                <textarea
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value)
                    parseCsvContent(e.target.value)
                  }}
                  rows={4}
                  placeholder="business_name,email,city,category&#10;Acme Inc,hello@acme.com,Austin,Tech"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                />
              </div>

              {parsedLeads.length > 0 && (
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Successfully parsed <strong>{parsedLeads.length}</strong> valid leads.</span>
                  </div>
                  <span className="text-zinc-400 text-[11px] truncate max-w-[200px]">
                    First: {parsedLeads[0].business_name}
                  </span>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-zinc-800">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={parsedLeads.length === 0}
                  loading={loading}
                  onClick={handleCsvSubmit}
                >
                  Import {parsedLeads.length > 0 ? `${parsedLeads.length} Leads` : ''}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
