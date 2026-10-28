import { create } from 'zustand'
import type { EmailTemplate } from '@sdk/core/types'
import { api } from '../services/api'

interface TemplatesState {
  templates: EmailTemplate[]
  loading: boolean
  fetchAll: () => Promise<void>
  create: (data: Partial<EmailTemplate>) => Promise<void>
  update: (id: number, data: Partial<EmailTemplate>) => Promise<void>
  remove: (id: number) => Promise<void>
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true })
    const data = await api.templates.getAll()
    set({ templates: data, loading: false })
  },

  create: async (data) => {
    await api.templates.create(data)
    await get().fetchAll()
  },

  update: async (id, data) => {
    await api.templates.update(id, data)
    await get().fetchAll()
  },

  remove: async (id) => {
    await api.templates.delete(id)
    await get().fetchAll()
  }
}))
