// src/screens/Leads/index.tsx
import { useEffect } from 'react'
import { Users, Download, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLeadsStore } from '../../store/leads.store'
import { LeadFilters } from './LeadFilters'
import { LeadRow } from './LeadRow'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { BulkActionsBar } from './BulkActionsBar'
import { AddLeadModal } from './AddLeadModal'
import { api } from '../../services/api'
import { useState } from 'react'

import { Pagination } from '../../components/ui/Pagination'
import { WebsiteAuditDrawer } from './WebsiteAuditDrawer'
import type { Lead } from '@sdk/core/types'

export function Leads() {
  const { leads, loading, fetchLeads, total, filters, setFilters } = useLeadsStore()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [auditLead, setAuditLead] = useState<Lead | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === leads.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(leads.map((l) => l.id)))
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const path = await api.outreach.exportCsv()
      if (path) toast.success(`Exported leads to ${path}`)
    } catch (err: any) {
      toast.error('Failed to export leads')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Leads</h2>
          <p className="text-sm text-slate-500 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExportCsv} loading={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add manually
          </Button>
        </div>
      </div>

      <LeadFilters />

      <BulkActionsBar
        selectedCount={selectedIds.size}
        leadIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
      />

      {loading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <Skeleton className="w-4 h-4 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-1/3 h-4" />
                <Skeleton className="w-1/4 h-3" />
              </div>
              <Skeleton className="w-24 h-6" />
              <Skeleton className="w-24 h-6" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Start a scrape run or add leads manually to fill your pipeline."
        />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-855 bg-zinc-950/40">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === leads.length && leads.length > 0}
                    onChange={toggleAll}
                    className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                {['Business', 'City', 'Date Added', 'Has Website', 'Has Phone', 'Email', 'Web Status', 'Lead Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  selected={selectedIds.has(lead.id)}
                  onToggle={toggleSelect}
                  onViewAudit={(leadToAudit) => setAuditLead(leadToAudit)}
                />
              ))}
            </tbody>
          </table>
          
          <Pagination
            page={filters.page || 1}
            pageSize={filters.pageSize || 50}
            total={total}
            onPageChange={(page) => setFilters({ page })}
            onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
          />
        </div>
      )}

      <WebsiteAuditDrawer 
        lead={auditLead}
        isOpen={auditLead !== null}
        onClose={() => setAuditLead(null)}
      />

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(count) => {
          toast.success(`Successfully added ${count} lead${count === 1 ? '' : 's'}`)
          fetchLeads()
        }}
      />
    </div>
  )
}
