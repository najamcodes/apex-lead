// src/screens/Leads/BulkActionsBar.tsx
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, CheckCircle2, Send, MailSearch, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useLeadsStore } from '../../store/leads.store'
import { useState } from 'react'

interface Props {
  selectedCount: number
  onClear: () => void
  leadIds: number[]
}

export function BulkActionsBar({ selectedCount, onClear, leadIds }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const { fetchLeads } = useLeadsStore()

  if (selectedCount === 0) return null

  const handleAction = async (actionId: string, fn: () => Promise<void>) => {
    setLoadingAction(actionId)
    await fn()
    setLoadingAction(null)
    onClear()
    fetchLeads()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence>
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          className="bg-zinc-800 border border-zinc-700 shadow-2xl rounded-full px-4 py-3 flex items-center gap-4"
        >
          <div className="flex items-center gap-2 pl-2 border-r border-zinc-700 pr-4">
            <div className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {selectedCount}
            </div>
            <span className="text-sm font-medium text-zinc-300">Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'analyze'}
              disabled={loadingAction !== null && loadingAction !== 'analyze'}
              onClick={() => handleAction('analyze', () => window.api.bulk.analyze(leadIds))}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              Analyze
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'score'}
              disabled={loadingAction !== null && loadingAction !== 'score'}
              onClick={() => handleAction('score', () => window.api.bulk.score(leadIds))}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              AI Score
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'approve'}
              disabled={loadingAction !== null && loadingAction !== 'approve'}
              onClick={() => handleAction('approve', () => window.api.bulk.approve(leadIds))}
            >
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'email_finder'}
              disabled={loadingAction !== null && loadingAction !== 'email_finder'}
              onClick={() => handleAction('email_finder', () => window.api.emailFinder.runBatch(leadIds))}
            >
              <MailSearch className="w-4 h-4 text-purple-400" />
              Find Emails
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'schedule'}
              disabled={loadingAction !== null && loadingAction !== 'schedule'}
              onClick={() => handleAction('schedule', () => window.api.bulk.scheduleSequences(leadIds, 1))} // Defaulting templateId 1 for now
            >
              <Send className="w-4 h-4 text-rose-400" />
              Schedule Seq
            </Button>
          </div>

          <button
            onClick={onClear}
            className="ml-2 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
