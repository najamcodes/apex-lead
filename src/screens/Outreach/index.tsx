// src/screens/Outreach/index.tsx
import { useEffect, useState } from 'react'
import { Send, Download, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { SendModal } from './SendModal'
import { SequencePanel } from './SequencePanel'
import { TemplateBuilder } from './TemplateBuilder'
import { QueueDashboard } from './QueueDashboard'
import { SchedulerStatusWidget } from './SchedulerStatusWidget'
import { useOutreachStore } from '../../store/outreach.store'
import { useLeadsStore } from '../../store/leads.store'
import type { Lead } from '../../types'

export function Outreach() {
  const { leads, fetchLeads } = useLeadsStore()
  const { sendBatch, fetchSequences, exportCsv } = useOutreachStore()
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<'queue' | 'sequences' | 'templates'>('queue')

  // Approved leads that don't have a sequence yet
  const approvedLeads = leads.filter((l) => l.status === 'approved')

  useEffect(() => {
    fetchLeads()
    fetchSequences()
  }, [])

  const handleSendDue = async () => {
    setSending(true)
    const result = await sendBatch()
    toast.success(
      `Sent ${result.sent} emails${result.failed > 0 ? `, ${result.failed} failed` : ''}`
    )
    setSending(false)
    fetchLeads()
    fetchSequences()
  }

  const handleExport = async () => {
    const path = await exportCsv()
    if (path) toast.success(`Exported to ${path}`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-3">
            Outreach
            <SchedulerStatusWidget />
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {approvedLeads.length} leads ready to contact
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchLeads()
              fetchSequences()
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="primary" size="sm" loading={sending} onClick={handleSendDue}>
            <Send className="w-3.5 h-3.5" />
            Send due emails
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 p-1 rounded-lg w-max shadow-sm">
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'queue' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => setActiveTab('queue')}
        >
          Sending Queue
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'sequences' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => setActiveTab('sequences')}
        >
          Active Sequences
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'templates' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
      </div>

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <QueueDashboard />
      )}

      {/* Sequences tab */}
      {activeTab === 'sequences' && <SequencePanel />}

      {/* Templates tab */}
      {activeTab === 'templates' && <TemplateBuilder />}

      {/* Send modal */}
      {selectedLead && <SendModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  )
}
