// frontend/screens/Approvals/index.tsx
// Human-in-the-Loop Approvals Inbox: review, modify, and action paused pipeline checkpoints.

import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import type { ApprovalSummary } from '../../services/api.interface'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Eye,
  AlertTriangle,
  Play,
  FileJson,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ApprovalsScreen() {
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalSummary | null>(null)
  const [search, setSearch] = useState('')

  // Edit / Action modal state
  const [editingRecords, setEditingRecords] = useState<any[]>([])
  const [reviewerNote, setReviewerNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [jsonView, setJsonView] = useState(false)
  const [rawJsonText, setRawJsonText] = useState('')

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.approvals.list(statusFilter)
      setApprovals(res.approvals || [])
      setPendingCount(res.pendingCount || 0)
    } catch (err: any) {
      toast.error(`Failed to load approvals: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadApprovals()
    const interval = setInterval(loadApprovals, 5000)
    return () => clearInterval(interval)
  }, [loadApprovals])

  const openReviewModal = (approval: ApprovalSummary) => {
    setSelectedApproval(approval)
    const initial = approval.modifiedRecords || approval.records || []
    setEditingRecords(JSON.parse(JSON.stringify(initial)))
    setRawJsonText(JSON.stringify(initial, null, 2))
    setReviewerNote(approval.reviewerNotes || '')
    setJsonView(false)
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedApproval) return
    try {
      setActionLoading(true)
      let finalRecords = editingRecords
      if (jsonView) {
        try {
          finalRecords = JSON.parse(rawJsonText)
        } catch {
          toast.error('Invalid JSON format in editor')
          setActionLoading(false)
          return
        }
      }

      await api.approvals.action(selectedApproval.id, action, finalRecords, reviewerNote)
      toast.success(action === 'approve' ? 'Pipeline approved & resumed!' : 'Pipeline run rejected.')
      setSelectedApproval(null)
      loadApprovals()
    } catch (err: any) {
      toast.error(`Action failed: ${err?.message || err}`)
    } finally {
      setActionLoading(false)
    }
  }

  const updateCell = (rowIndex: number, key: string, value: any) => {
    setEditingRecords(prev => {
      const copy = [...prev]
      if (copy[rowIndex]) {
        copy[rowIndex] = {
          ...copy[rowIndex],
          data: { ...(copy[rowIndex].data || {}), [key]: value },
        }
      }
      setRawJsonText(JSON.stringify(copy, null, 2))
      return copy
    })
  }

  const filteredApprovals = approvals.filter(a =>
    !search ||
    a.nodeLabel.toLowerCase().includes(search.toLowerCase()) ||
    a.runId.toLowerCase().includes(search.toLowerCase()) ||
    (a.reviewerNotes || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Human-in-the-Loop Approvals</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  {pendingCount} Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Review, edit, and approve records before autonomous pipelines dispatch actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-md font-medium capitalize transition-all ${
                  statusFilter === tab
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={loadApprovals}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Refresh Approvals"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-6xl w-full mx-auto">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search approvals by checkpoint, run ID, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Approvals List */}
        {filteredApprovals.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">All Clear! No Approvals Pending</h3>
            <p className="text-xs text-slate-500 mt-1">
              When a pipeline hits a Human Approval Checkpoint node, it will appear here for your review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredApprovals.map(a => (
              <div
                key={a.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{a.nodeLabel}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Run: {a.runId.slice(0, 8)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                      {a.recordCount} Records
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-medium uppercase ${
                        a.status === 'pending' ? 'bg-amber-950/80 text-amber-300 border border-amber-800' :
                        a.status === 'approved' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' :
                        'bg-red-950/80 text-red-300 border border-red-800'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 italic">
                    "{a.reviewerNotes || 'Requires human verification before proceeding.'}"
                  </p>

                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Created: {new Date(a.createdAt).toLocaleString()}</span>
                    {a.reviewedAt && <span>• Reviewed: {new Date(a.reviewedAt).toLocaleString()}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openReviewModal(a)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{a.status === 'pending' ? 'Review & Decide' : 'Inspect Records'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review & Edit Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {selectedApproval.nodeLabel} — Reviewing {editingRecords.length} Records
                  </h3>
                  <p className="text-xs text-slate-400">
                    Run ID: <span className="font-mono text-slate-200">{selectedApproval.runId}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setJsonView(!jsonView)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 border border-slate-700"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>{jsonView ? 'Grid View' : 'Raw JSON'}</span>
                </button>
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  You can edit values inline directly in this table before approving. Modified values will be emitted to downstream nodes.
                </span>
              </div>

              {jsonView ? (
                <textarea
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  className="w-full h-80 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:border-amber-500"
                />
              ) : (
                <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Business / Title</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Website</th>
                        <th className="p-2.5">AI Score / Subject</th>
                        <th className="p-2.5">City</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {editingRecords.map((rec, idx) => {
                        const d = rec.data || {}
                        return (
                          <tr key={rec.id || idx} className="hover:bg-slate-900/50">
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={d.business_name || d.name || d.title || ''}
                                onChange={(e) => updateCell(idx, d.business_name ? 'business_name' : 'name', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-white w-full"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={d.email || ''}
                                onChange={(e) => updateCell(idx, 'email', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-emerald-400 w-full"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={d.website_url || d.website || ''}
                                onChange={(e) => updateCell(idx, 'website_url', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-cyan-400 w-full"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={d.ai_site_score || d.subject || d.score || ''}
                                onChange={(e) => updateCell(idx, 'subject', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-indigo-300 w-full"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={d.city || ''}
                                onChange={(e) => updateCell(idx, 'city', e.target.value)}
                                className="bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-slate-300 w-full"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Reviewer Note */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Operator Review Notes (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Verified emails and customized opening pitch."
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                onClick={() => setSelectedApproval(null)}
                className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>

              {selectedApproval.status === 'pending' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject & Drop</span>
                  </button>

                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Approve & Resume Pipeline</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-400 capitalize">
                  Status: {selectedApproval.status}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
