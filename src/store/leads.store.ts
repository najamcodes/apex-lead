// src/store/leads.store.ts
import { create } from 'zustand'
import type { Lead, LeadFilters, LeadStatus } from '../types'

interface LeadsState {
  leads: Lead[]
  filters: LeadFilters
  loading: boolean
  error: string | null
  // Actions
  fetchLeads: () => Promise<void>
  setFilters: (filters: LeadFilters) => void
  updateStatus: (id: number, status: LeadStatus, notes?: string) => Promise<void>
  deleteLead: (id: number) => Promise<void>
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  filters: { status: 'all', website_status: 'all' },
  loading: false,
  error: null,

  fetchLeads: async () => {
    set({ loading: true, error: null })
    try {
      const leads = await window.api.leads.getAll(get().filters)
      set({ leads, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  setFilters: (filters) => {
    set({ filters })
    get().fetchLeads()
  },

  updateStatus: async (id, status, notes) => {
    await window.api.leads.updateStatus(id, status, notes)
    await get().fetchLeads()
  },

  deleteLead: async (id) => {
    await window.api.leads.delete(id)
    await get().fetchLeads()
  },
}))
