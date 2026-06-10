// src/store/outreach.store.ts
import { create } from 'zustand'
import type { OutreachRecord, SequenceSummary } from '../types/outreach.types'

interface OutreachState {
  records: OutreachRecord[]
  sequences: SequenceSummary[]
  sending: boolean
  // Actions
  fetchAll:       ()                                           => Promise<void>
  fetchSequences: ()                                           => Promise<void>
  send:           (recordId: number)                           => Promise<void>
  sendBatch:      ()                                           => Promise<{ sent: number; failed: number }>
  markReplied:    (outreachId: number)                         => Promise<void>
  markBounced:    (outreachId: number)                         => Promise<void>
  scheduleSeq:    (input: unknown, businessName: string)       => Promise<void>
  exportCsv:      ()                                           => Promise<string | null>
}

export const useOutreachStore = create<OutreachState>((set, get) => ({
  records:   [],
  sequences: [],
  sending:   false,

  fetchAll: async () => {
    const records = await window.api.outreach.getAll()
    set({ records })
  },

  fetchSequences: async () => {
    const sequences = await window.api.outreach.getSequences()
    set({ sequences })
  },

  send: async (recordId) => {
    set({ sending: true })
    await window.api.outreach.send(recordId)
    await get().fetchAll()
    set({ sending: false })
  },

  sendBatch: async () => {
    set({ sending: true })
    const result = await window.api.outreach.sendBatch()
    await get().fetchAll()
    set({ sending: false })
    return result
  },

  markReplied: async (outreachId) => {
    await window.api.outreach.markReplied(outreachId)
    await get().fetchAll()
    await get().fetchSequences()
  },

  markBounced: async (outreachId) => {
    await window.api.outreach.markBounced(outreachId)
    await get().fetchAll()
  },

  scheduleSeq: async (input, businessName) => {
    await window.api.outreach.scheduleSeq(input, businessName)
    await get().fetchSequences()
  },

  exportCsv: () => window.api.outreach.exportCsv(),
}))
