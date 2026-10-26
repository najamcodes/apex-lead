// src/screens/Leads/BulkActionsBar.tsx
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, CheckCircle2, Send, MailSearch, X, UserCheck, Sparkles, Ban } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useLeadsStore } from '../../store/leads.store'
import { useTemplatesStore } from '../../store/templates.store'
import { useState, useEffect } from 'react'
import { api } from '../../services/api'

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
              onClick={() => handleAction('analyze', () => api.bulk.analyze(leadIds))}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              Analyze
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'score'}
              disabled={loadingAction !== null && loadingAction !== 'score'}
              onClick={() => handleAction('score', () => api.bulk.score(leadIds))}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              AI Score
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'approve'}
              disabled={loadingAction !== null && loadingAction !== 'approve'}
              onClick={() => handleAction('approve', () => api.bulk.approve(leadIds))}
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
                handleAction('email_finder', () => api.emailFinder.runBatch(leadIds))
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
                handleAction('email_verifier', () => api.emailVerifier.runBatch(leadIds))
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
            <Button
              variant="secondary"
              size="sm"
              loading={loadingAction === 'suppress'}
              disabled={loadingAction !== null && loadingAction !== 'suppress'}
              onClick={() =>
                handleAction('suppress', async () => {
                  const selectedLeads = useLeadsStore.getState().leads.filter(l => leadIds.includes(l.id))
                  const targets = selectedLeads
                    .map(l => l.email || '')
                    .filter(Boolean)
                  if (targets.length > 0) {
                    await api.suppression.batchAdd(targets, 'email', 'manual')
                  }
                })
              }
            >
              <Ban className="w-4 h-4 text-red-400" />
              Add to DNC
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
            
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
              <button
                className="w-full text-left px-4 py-3 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-900/50 hover:border-emerald-500/50 rounded-lg transition-colors flex items-center gap-3"
                onClick={() => {
                  setShowTemplateModal(false)
                  handleAction('schedule', () => api.bulk.scheduleSequences(leadIds))
                }}
              >
                <div className="bg-emerald-500/20 p-2 rounded-full text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-sm text-emerald-400">Draft with AI</div>
                  <div className="text-xs text-emerald-500/70 mt-0.5">Generate highly personalized emails using your OpenRouter API</div>
                </div>
              </button>

              {templates.length === 0 ? (
                <p className="text-sm text-zinc-500 mt-4 px-2">No static templates created yet.</p>
              ) : (
                <>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-zinc-900 px-2 text-zinc-500 uppercase tracking-wider">Or select template</span>
                    </div>
                  </div>
                  {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    className="w-full text-left px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-emerald-500/50 rounded-lg transition-colors"
                    onClick={() => {
                      setShowTemplateModal(false)
                      handleAction('schedule', () => api.bulk.scheduleSequences(leadIds, tpl.id))
                    }}
                  >
                    <div className="font-medium text-sm text-zinc-200">{tpl.name}</div>
                    <div className="text-xs text-zinc-500 truncate mt-1">Subj: {tpl.subject}</div>
                  </button>
                ))}
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
