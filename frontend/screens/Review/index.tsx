// src/screens/Review/index.tsx
import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { RefreshCw, Zap, Loader2 } from 'lucide-react'
import { KanbanColumn } from './KanbanColumn'
import { LeadDrawer } from './LeadDrawer'
import { Button } from '../../components/ui/Button'
import { useLeadsStore } from '../../store/leads.store'
import type { Lead, LeadStatus } from '@sdk/core/types'
import { api } from '../../services/api'

const COLUMNS: { id: LeadStatus; title: string; accent: string }[] = [
  { id: 'qualified', title: 'To Review', accent: 'bg-blue-400' },
  { id: 'approved', title: 'Approved', accent: 'bg-emerald-400' },
  { id: 'skipped', title: 'Skipped', accent: 'bg-zinc-500' }
]

export function Review() {
  const { leads, fetchLeads, setFilters, updateStatus } = useLeadsStore()
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(
    null
  )

  useEffect(() => {
    setFilters({ status: 'all', sortBy: 'priority_score', sortDir: 'desc' })
  }, [])

  // Subscribe to analysis progress events
  useEffect(() => {
    const cleanup = api.analysis.onProgress((data: any) => {
      setAnalyzeProgress({ done: data.done, total: data.total })
      if (data.done === data.total) {
        setAnalyzing(false)
        setAnalyzeProgress(null)
        fetchLeads()
      }
    })
    return cleanup
  }, [])

  // Group leads by status for Kanban columns
  const columnLeads = (status: LeadStatus) => leads.filter((l) => l.status === status)

  // Handle drag end — update status based on destination column
  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      const newStatus = result.destination.droppableId as LeadStatus
      const leadId = parseInt(result.draggableId)
      await updateStatus(leadId, newStatus)
    },
    [updateStatus]
  )

  // Run analysis on all scraped/qualified leads that haven't been scored yet
  const handleRunAnalysis = async () => {
    const unanalyzed = leads
      .filter((l) => ['scraped', 'qualified'].includes(l.status) && l.ai_site_score === null)
      .map((l) => l.id)

    if (unanalyzed.length === 0) return
    setAnalyzing(true)
    setAnalyzeProgress({ done: 0, total: unanalyzed.length })
    await api.analysis.runBatch(unanalyzed)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Review</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Drag leads to approve or skip</p>
        </div>
        <div className="flex items-center gap-3">
          {analyzeProgress && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {analyzeProgress.done}/{analyzeProgress.total} analyzed
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={() => fetchLeads()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button variant="primary" size="sm" loading={analyzing} onClick={handleRunAnalysis}>
            <Zap className="w-3.5 h-3.5" />
            Analyze unscored
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              accent={col.accent}
              leads={columnLeads(col.id)}
              onCardClick={setSelectedLead}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Lead detail drawer */}
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  )
}
