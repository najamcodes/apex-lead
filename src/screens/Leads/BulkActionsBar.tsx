// src/screens/Leads/BulkActionsBar.tsx
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, CheckCircle2, Send, MailSearch, X, UserCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useLeadsStore } from '../../store/leads.store'
import { useTemplatesStore } from '../../store/templates.store'
import { useState, useEffect } from 'react'

interface Props {
  selectedCount: number
  onClear: () => void
  leadIds: number[]
}

export function BulkActionsBar({ selectedCount, onClear, leadIds }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const { fetchLeads } = useLeadsStore()
  const { templates, fetchAll: fetchTemplates } = useTemplatesStore()

  useEffect(() => {
    fetchTemplates()
  }, [])

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
              onClick={() =>
                handleAction('email_finder', () => window.api.emailFinder.runBatch(leadIds))
              }
            >
              <MailSearch className="w-4 h-4 text-purple-400" />
              Find Emails
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'email_verifier'}
              disabled={loadingAction !== null && loadingAction !== 'email_verifier'}
              onClick={() =>
                handleAction('email_verifier', () => window.api.emailVerifier.runBatch(leadIds))
              }
            >
              <UserCheck className="w-4 h-4 text-pink-400" />
              Verify Emails
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'schedule'}
              disabled={loadingAction !== null && loadingAction !== 'schedule'}
              onClick={() => setShowTemplateModal(true)}
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

      {/* Template Selector Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">Select Template</h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {templates.length === 0 ? (
              <p className="text-sm text-zinc-400 mb-6">No templates created yet. Please create one in the Outreach tab.</p>
            ) : (
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    className="w-full text-left px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-emerald-500/50 rounded-lg transition-colors"
                    onClick={() => {
                      setShowTemplateModal(false)
                      handleAction('schedule', () => window.api.bulk.scheduleSequences(leadIds, tpl.id))
                    }}
                  >
                    <div className="font-medium text-sm text-zinc-200">{tpl.name}</div>
                    <div className="text-xs text-zinc-500 truncate mt-1">Subj: {tpl.subject}</div>
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
