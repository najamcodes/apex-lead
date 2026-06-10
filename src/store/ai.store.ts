// src/store/ai.store.ts
import { create } from 'zustand'
import type { SiteScoreResult, OutreachDraft, AiTaskProgress } from '../types/ai.types'

interface AiState {
  taskQueue: AiTaskProgress[]
  siteScores: Record<number, SiteScoreResult>   // keyed by lead_id
  outreachDrafts: Record<number, OutreachDraft> // keyed by lead_id
  // Actions
  scoreSite: (leadId: number) => Promise<void>
  draftEmail: (leadId: number) => Promise<void>
  scoreBatch: (leadIds: number[]) => Promise<void>
}

export const useAiStore = create<AiState>((set, get) => ({
  taskQueue: [],
  siteScores: {},
  outreachDrafts: {},

  scoreSite: async (leadId) => {
    set((s) => ({
      taskQueue: [...s.taskQueue, { lead_id: leadId, task: 'score_site', status: 'running' }],
    }))
    try {
      const result = await window.api.ai.scoreSite(leadId)
      set((s) => ({
        siteScores: { ...s.siteScores, [leadId]: result },
        taskQueue: s.taskQueue.map((t) =>
          t.lead_id === leadId && t.task === 'score_site' ? { ...t, status: 'done' } : t
        ),
      }))
    } catch (err) {
      set((s) => ({
        taskQueue: s.taskQueue.map((t) =>
          t.lead_id === leadId && t.task === 'score_site'
            ? { ...t, status: 'error', error: String(err) }
            : t
        ),
      }))
    }
  },

  draftEmail: async (leadId) => {
    set((s) => ({
      taskQueue: [...s.taskQueue, { lead_id: leadId, task: 'draft_email', status: 'running' }],
    }))
    try {
      const result = await window.api.ai.draftEmail(leadId)
      set((s) => ({
        outreachDrafts: { ...s.outreachDrafts, [leadId]: result },
        taskQueue: s.taskQueue.map((t) =>
          t.lead_id === leadId && t.task === 'draft_email' ? { ...t, status: 'done' } : t
        ),
      }))
    } catch (err) {
      set((s) => ({
        taskQueue: s.taskQueue.map((t) =>
          t.lead_id === leadId && t.task === 'draft_email'
            ? { ...t, status: 'error', error: String(err) }
            : t
        ),
      }))
    }
  },

  // Batch score multiple leads with a small delay to avoid rate limits
  scoreBatch: async (leadIds) => {
    for (const id of leadIds) {
      await get().scoreSite(id)
      await new Promise((r) => setTimeout(r, 500)) // 500ms between calls
    }
  },
}))
