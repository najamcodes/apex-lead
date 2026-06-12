// src/store/outreach.store.ts
import { create } from 'zustand'
import type { OutreachRecord, SequenceSummary } from '../types/outreach.types'

interface OutreachState {
  records: OutreachRecord[]
  sequences: SequenceSummary[]
  page: number
  pageSize: number
  total: number
  sending: boolean
  // Actions
  setPagination: (page: number, pageSize?: number) => void
  fetchAll: () => Promise<void>
  fetchSequences: () => Promise<void>
  send: (recordId: number) => Promise<void>
  sendBatch: () => Promise<{ sent: number; failed: number }>
  markReplied: (outreachId: number) => Promise<void>
  markBounced: (outreachId: number) => Promise<void>
  scheduleSeq: (input: unknown, businessName: string) => Promise<void>
  exportCsv: () => Promise<string | null>
}

export const useOutreachStore = create<OutreachState>((set, get) => ({
  records: [],
  sequences: [],
  page: 1,
  pageSize: 50,
  total: 0,
  sending: false,

  setPagination: (page, pageSize) => {
    set({ page, pageSize: pageSize || get().pageSize })
    get().fetchSequences() // Sequences table is the main one right now
  },

  fetchAll: async () => {
    const { data, total } = await window.api.outreach.getAll(undefined, { page: get().page, pageSize: get().pageSize })
    set({ records: data, total })
  },

  fetchSequences: async () => {
    const { data, total } = await window.api.outreach.getSequences({ page: get().page, pageSize: get().pageSize })
    set({ sequences: data, total })
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

  exportCsv: () => window.api.outreach.exportCsv()
}))
