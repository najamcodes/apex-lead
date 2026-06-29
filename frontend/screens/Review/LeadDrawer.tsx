// src/screens/Review/LeadDrawer.tsx
import { useEffect, useState } from 'react'
import { X, Globe, Phone, MapPin, Shield, Copy, Check, Loader2, Users, Sparkles, Star, MessageSquare, Server, Mail, CheckCircle2, AlertCircle, AlertTriangle, Link as LinkIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useAiStore } from '../../store/ai.store'
import { useNotesStore } from '../../store/notes.store'
import { useActivityStore } from '../../store/activity.store'
import type { Lead } from '../../../shared/types'

interface LeadDrawerProps {
  lead: Lead | null
  onClose: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

export function LeadDrawer({ lead, onClose }: LeadDrawerProps) {
  const { outreachDrafts, draftEmail, taskQueue } = useAiStore()
  const draft = lead ? outreachDrafts[lead.id] : null
  const isDrafting = taskQueue.some(
    (t) => t.lead_id === lead?.id && t.task === 'draft_email' && t.status === 'running'
  )

  const { note, fetchNote, saveNote } = useNotesStore()
  const { activities, fetchActivity } = useActivityStore()
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't close if they are typing in the textarea
      if (e.key === 'Escape' && document.activeElement?.tagName !== 'TEXTAREA') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (lead) {
      fetchNote(lead.id)
      fetchActivity(lead.id)
    }
  }, [lead])

  useEffect(() => {
    setNoteText(note?.body || '')
  }, [note])

  const handleSaveNote = async () => {
    if (!lead) return
    setSavingNote(true)
    await saveNote(lead.id, noteText)
    setSavingNote(false)
  }

  if (!lead) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-zinc-950 border-l border-zinc-800 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{lead.business_name}</h2>
            <p className="text-sm text-zinc-500">
              {lead.category} · {lead.city}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Status badges */}
          <div className="flex gap-2">
            <Badge type="lead_status" value={lead.status} />
            <Badge type="website_status" value={lead.website_status} />
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Contact</h3>
            <div className="space-y-1.5">
              {lead.website_url && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Globe className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <a
                    href={lead.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-emerald-400 transition-colors truncate"
                  >
                    {lead.website_url}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Phone className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span>{lead.phone}</span>
                </div>
              )}
              {lead.city && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span>
                    {lead.city}, {lead.country}
                  </span>
                </div>
              )}
              {lead.contact_name && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Users className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span>{lead.contact_name} (Extracted)</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                  {lead.email_verified === true && (
                    <div title="Verified" className="flex">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    </div>
                  )}
                  {lead.email_verified === false && (
                    <div title="Bounced / Invalid" className="flex">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Social Links */}
          {lead.social_links && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Social Links</h3>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  try {
                    const socials = JSON.parse(lead.social_links);
                    return Object.entries(socials).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url as string}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 rounded hover:bg-zinc-800 transition-colors capitalize"
                      >
                        <LinkIcon className="w-3 h-3 text-zinc-500" />
                        {platform}
                      </a>
                    ));
                  } catch { return null }
                })()}
              </div>
            </div>
          )}

          {/* Site analysis */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Site analysis & Priority
            </h3>

            {/* Priority Details */}
            {lead.priority_score !== null && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-300">Priority Score</span>
                  <span className={`text-sm font-bold ${lead.priority_score >= 70 ? 'text-red-400' : lead.priority_score >= 40 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {lead.priority_score}/100
                  </span>
                </div>
                {lead.priority_breakdown && (
                  <div className="space-y-1 mt-2 border-t border-zinc-800 pt-2">
                    {(() => {
                      try {
                        const data = JSON.parse(lead.priority_breakdown)
                        return (data.reasons || []).map((reason: string, i: number) => (
                          <div key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                            <span className="text-emerald-500/50 mt-0.5">•</span>
                            <span>{reason}</span>
                          </div>
                        ))
                      } catch {
                        return null
                      }
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xl font-semibold text-zinc-100">
                  {lead.pagespeed_mobile ?? '—'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Mobile</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xl font-semibold text-zinc-100">
                  {lead.pagespeed_desktop ?? '—'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Desktop</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                <p className="text-xl font-semibold text-zinc-100">{lead.ai_site_score ?? '—'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">AI score</p>
              </div>
            </div>

            {lead.ssl_valid !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Shield
                  className={`w-3.5 h-3.5 ${lead.ssl_valid ? 'text-emerald-400' : 'text-red-400'}`}
                />
                <span className={lead.ssl_valid ? 'text-zinc-300' : 'text-red-400'}>
                  {lead.ssl_valid ? 'SSL valid' : 'No SSL certificate'}
                </span>
              </div>
            )}

            {lead.ai_site_summary && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1">AI assessment</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{lead.ai_site_summary}</p>
              </div>
            )}

            {lead.ai_personalized_hook && (
              <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-medium text-emerald-400">AI Personalized Hook</p>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic">
                  "{lead.ai_personalized_hook}"
                </p>
              </div>
            )}

            {lead.ai_icebreaker && (
              <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-medium text-emerald-400">AI Icebreaker</p>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic">
                  "{lead.ai_icebreaker}"
                </p>
              </div>
            )}

            {lead.ai_service_pitch && (
              <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <p className="text-xs font-medium text-indigo-400">Suggested Service Pitch</p>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {lead.ai_service_pitch}
                </p>
              </div>
            )}

            {lead.site_built_year && (
              <p className="text-xs text-zinc-500">
                Estimated build year: <span className="text-zinc-400">{lead.site_built_year}</span>
              </p>
            )}

            {lead.seo_metrics && (
              <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <p className="text-xs font-medium text-red-400">Failed SEO / Accessibility Audits</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    try {
                      const audits = JSON.parse(lead.seo_metrics);
                      return audits.map((audit: string) => (
                        <span key={audit} className="px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-300 rounded border border-red-500/20">
                          {audit}
                        </span>
                      ));
                    } catch { return null }
                  })()}
                </div>
              </div>
            )}

            {(lead.review_rating != null || lead.tech_stack) && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {lead.review_rating != null && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <p className="text-sm font-semibold text-zinc-100">{lead.review_rating.toFixed(1)}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <MessageSquare className="w-3 h-3" />
                        {lead.review_count}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">Google Reputation</p>
                  </div>
                )}
                {lead.tech_stack && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 col-span-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Server className="w-3.5 h-3.5 text-blue-400" />
                      <p className="text-xs font-medium text-blue-400">Detected Tech Stack</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        try {
                          const tech = JSON.parse(lead.tech_stack);
                          return tech.map((t: string) => (
                            <span key={t} className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-300 rounded border border-blue-500/20">
                              {t}
                            </span>
                          ));
                        } catch { return null }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add details, context, or meeting notes..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 min-h-[100px] focus:outline-none focus:border-primary/50 resize-y"
            />
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" loading={savingNote} onClick={handleSaveNote}>
                Save Note
              </Button>
            </div>
          </div>

          {/* Outreach draft */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Outreach
              </h3>
              <Button
                variant="ghost"
                size="sm"
                loading={isDrafting}
                onClick={() => draftEmail(lead.id)}
              >
                {draft ? 'Regenerate' : 'Draft with AI'}
              </Button>
            </div>

            {isDrafting && (
              <div className="flex items-center gap-2 text-sm text-zinc-500 py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Drafting outreach…
              </div>
            )}

            {draft && !isDrafting && (
              <div className="space-y-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-zinc-500">Subject</p>
                    <CopyButton text={draft.subject} />
                  </div>
                  <p className="text-sm text-zinc-200">{draft.subject}</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-500">Email body</p>
                    <CopyButton text={draft.email_body} />
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {draft.email_body}
                  </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-500">LinkedIn DM</p>
                    <CopyButton text={draft.linkedin_dm} />
                  </div>
                  <p className="text-sm text-zinc-300">{draft.linkedin_dm}</p>
                </div>

                <p className="text-xs text-zinc-600">Model: {draft.model_used}</p>
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Activity Log
            </h3>
            <div className="space-y-4">
              {activities.length === 0 && (
                <p className="text-sm text-zinc-500">No activity recorded yet.</p>
              )}
              {activities.map((act) => (
                <div key={act.id} className="relative pl-4 border-l border-zinc-800">
                  <div className="absolute -left-1.5 top-1.5 w-3 h-3 bg-zinc-800 rounded-full border border-zinc-950" />
                  <p className="text-xs text-zinc-500 mb-0.5">
                    {new Date(act.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm font-medium text-zinc-300 capitalize">
                    {act.event.replace(/_/g, ' ')}
                  </p>
                  {act.detail && <p className="text-sm text-zinc-400 mt-1">{act.detail}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
