// src/screens/Outreach/SendModal.tsx
// Review + edit the outreach draft before sending, then trigger sequence scheduling.

import { useState } from 'react'
import { X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useOutreachStore } from '../../store/outreach.store'
import { useAiStore } from '../../store/ai.store'
import type { Lead } from '../../types'

interface SendModalProps {
  lead: Lead
  onClose: () => void
}

export function SendModal({ lead, onClose }: SendModalProps) {
  const { outreachDrafts } = useAiStore()
  const { scheduleSeq } = useOutreachStore()
  const draft = outreachDrafts[lead.id]

  const [email, setEmail]     = useState(lead.email ?? '')
  const [subject, setSubject] = useState(draft?.subject ?? '')
  const [body, setBody]       = useState(draft?.email_body ?? '')
  const [sending, setSending] = useState(false)

  const handleSchedule = async () => {
    if (!email) { toast.error('Add an email address first'); return }
    if (!subject || !body) { toast.error('Subject and body required'); return }
    setSending(true)
    try {
      // Save email to lead if it was manually entered
      if (!lead.email && email) {
        await window.api.leads.updateStatus(lead.id, lead.status)
        // Note: a full leads update endpoint is added in the leads IPC patch below
      }

      await scheduleSeq(
        { lead_id: lead.id, email, subject, email_body: body, send_immediately: true },
        lead.business_name
      )

      toast.success(`Outreach sequence scheduled for ${lead.business_name}`)
      onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Send outreach</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{lead.business_name}</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Input
              label="Recipient email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@business.com"
            />
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Email body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700
                  text-zinc-100 placeholder-zinc-500 outline-none
                  focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30
                  transition-colors resize-none font-mono leading-relaxed"
              />
            </div>

            <div className="bg-zinc-800/50 rounded-lg px-3 py-2 text-xs text-zinc-500">
              Scheduling a 3-step sequence: send now → follow-up day 3 → follow-up day 14
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={sending} onClick={handleSchedule}>
              <Send className="w-3.5 h-3.5" />
              Schedule sequence
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
