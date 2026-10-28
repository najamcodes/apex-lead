// src/store/leads.store.ts
import { create } from 'zustand'
import type { Lead, LeadFilters, LeadStatus, LeadInsert } from '@sdk/core/types'
import { api } from '../services/api'

interface LeadsState {
  leads: Lead[]
  filters: LeadFilters
  total: number
  loading: boolean
  error: string | null
  // Actions
  fetchLeads: () => Promise<void>
  setFilters: (filters: LeadFilters) => void
  updateStatus: (id: number, status: LeadStatus, notes?: string) => Promise<void>
  deleteLead: (id: number) => Promise<void>
  addLead: (data: LeadInsert) => Promise<Lead>
  importBatch: (leads: LeadInsert[]) => Promise<{ imported: number; skipped: number }>
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  filters: { status: 'all', website_status: 'all', page: 1, pageSize: 50 },
  total: 0,
  loading: false,
  error: null,

  fetchLeads: async () => {
    set({ loading: true, error: null })
    try {
      const { data, total } = await api.leads.getAll(get().filters)
      set({ leads: data, total, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  setFilters: (filters) => {
    // If setting filters that aren't page/pageSize, reset to page 1
    const isPaginationOnly = Object.keys(filters).every(k => k === 'page' || k === 'pageSize');
    set({ 
      filters: { 
        ...get().filters, 
        ...filters,
        page: isPaginationOnly ? filters.page || get().filters.page : 1
      } 
    })
    get().fetchLeads()
  },

  updateStatus: async (id, status, notes) => {
    await api.leads.updateStatus(id, status, notes)
    await get().fetchLeads()
  },

  deleteLead: async (id) => {
    await api.leads.delete(id)
    await get().fetchLeads()
  },

  addLead: async (data) => {
    const lead = await api.leads.insert(data)
    await get().fetchLeads()
    return lead
  },

  importBatch: async (leads) => {
    const res = await api.leads.insertBatch(leads)
    await get().fetchLeads()
    return res
  }
}))
