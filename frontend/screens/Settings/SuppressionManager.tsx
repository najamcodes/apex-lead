// frontend/screens/Settings/SuppressionManager.tsx
import { useState, useEffect } from 'react'
import { ShieldAlert, Plus, Trash2, Search, CheckCircle, Ban, Upload, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

interface SuppressionItem {
  id: number
  org_id: number
  type: 'email' | 'domain' | 'phone'
  value: string
  reason: 'unsubscribed' | 'manual' | 'bounced' | 'complaint'
  created_at: string
}

export function SuppressionManager() {
  const [items, setItems] = useState<SuppressionItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Add single modal/form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [newType, setNewType] = useState<'email' | 'domain' | 'phone'>('email')
  const [newReason, setNewReason] = useState<'manual' | 'unsubscribed' | 'bounced' | 'complaint'>('manual')

  // Bulk paste state
  const [bulkText, setBulkText] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)

  // Tester state
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<boolean | null>(null)

  const loadSuppressions = async () => {
    setLoading(true)
    try {
      const res = await api.suppression.getAll({ search: search || undefined })
      setItems(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load suppression list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppressions()
  }, [search])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newValue.trim()) return

    try {
      await api.suppression.add({
        value: newValue.trim(),
        type: newType,
        reason: newReason,
      })
      toast.success(`Added ${newValue} to Do-Not-Contact list`)
      setNewValue('')
      setShowAddForm(false)
      loadSuppressions()
    } catch {
      toast.error('Failed to add suppression entry')
    }
  }

  const handleBulkAdd = async () => {
    const lines = bulkText.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean)
    if (lines.length === 0) return

    try {
      const res = await api.suppression.batchAdd(lines, 'email', 'manual')
      toast.success(`Suppressed ${res.added} items (${res.skipped} skipped/already present)`)
      setBulkText('')
      setShowBulkModal(false)
      loadSuppressions()
    } catch {
      toast.error('Failed to batch add suppressions')
    }
  }

  const handleDelete = async (id: number, val: string) => {
    try {
      await api.suppression.remove(id)
      toast.success(`Removed ${val} from suppression list`)
      loadSuppressions()
    } catch {
      toast.error('Failed to remove entry')
    }
  }

  const handleTestCheck = async () => {
    if (!testQuery.trim()) return
    try {
      const isBlocked = await api.suppression.check(testQuery.trim())
      setTestResult(isBlocked)
    } catch {
      toast.error('Check failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              Do-Not-Contact (DNC) & Suppression
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                {total} blocked
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Global blacklist preventing outreach sequences from ever contacting suppressed emails, competitor domains, or opt-out recipients.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowBulkModal(true)}>
            <Upload className="w-4 h-4 mr-1.5" />
            Bulk Paste
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Quick Lookup Tester */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <Input
            placeholder="Test an email (e.g. lead@domain.com) or domain (e.g. competitor.com) to verify DNC status..."
            value={testQuery}
            onChange={(e) => { setTestQuery(e.target.value); setTestResult(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleTestCheck()}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleTestCheck}>
          Check DNC Status
        </Button>
        {testResult !== null && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 ${
            testResult
              ? 'bg-red-950/60 text-red-400 border border-red-800/60'
              : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
          }`}>
            {testResult ? (
              <>
                <Ban className="w-4 h-4 text-red-400" />
                <span>BLOCKED (Outreach prohibited)</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>CLEAN (Deliverable)</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter and Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search suppressed values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-primary"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={loadSuppressions} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-zinc-300">No suppressions found</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Your suppression list is empty. Add domains or emails to safeguard deliverability and respect opt-outs.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-medium">
                <th className="px-4 py-3">Blocked Target</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Date Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-zinc-200">
                    {item.value}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize px-2 py-0.5 rounded-full text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`capitalize px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      item.reason === 'unsubscribed'
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                        : item.reason === 'bounced'
                        ? 'bg-purple-950/60 text-purple-400 border border-purple-800/50'
                        : 'bg-zinc-800/80 text-zinc-300'
                    }`}>
                      {item.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(item.id, item.value)}
                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                      title="Remove from suppression list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Single Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Add to Do-Not-Contact List</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target (Email, Domain, or Phone)
                </label>
                <Input
                  placeholder="e.g. competitor.com or optout@company.com"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e: any) => setNewType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value="email">Email</option>
                    <option value="domain">Domain</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Reason</label>
                  <select
                    value={newReason}
                    onChange={(e: any) => setNewReason(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="unsubscribed">Unsubscribed</option>
                    <option value="bounced">Bounced</option>
                    <option value="complaint">Complaint</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Add to DNC
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Bulk Paste Suppression List</h3>
            <p className="text-xs text-zinc-400">
              Paste comma, semicolon, or newline separated emails and domains.
            </p>
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="competitor.com&#10;optout@client.com&#10;test@example.com"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowBulkModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleBulkAdd} disabled={!bulkText.trim()}>
                Import All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
