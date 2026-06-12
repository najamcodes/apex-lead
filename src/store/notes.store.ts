// src/store/notes.store.ts
import { create } from 'zustand'
import type { NoteRecord } from '../types/activity.types'

interface NotesState {
  note: NoteRecord | null
  isLoading: boolean
  fetchNote: (leadId: number) => Promise<void>
  saveNote: (leadId: number, body: string) => Promise<void>
}

export const useNotesStore = create<NotesState>((set) => ({
  note: null,
  isLoading: false,

  fetchNote: async (leadId) => {
    set({ isLoading: true })
    const note = await window.api.notes.get(leadId)
    set({ note, isLoading: false })
  },

  saveNote: async (leadId, body) => {
    const updated = await window.api.notes.save(leadId, body)
    set({ note: updated })
  }
}))
