// src/store/settings.store.ts
import { create } from 'zustand'
import type { AppSettings } from '../types'

interface SettingsState {
  settings: AppSettings | null
  loaded: boolean
  saving: boolean
  load: () => Promise<void>
  save: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loaded: false,
  saving: false,

  load: async () => {
    const settings = await window.api.settings.get()
    set({ settings, loaded: true })
  },

  save: async (patch) => {
    set({ saving: true })
    await window.api.settings.save(patch)
    await get().load()
    set({ saving: false })
  },
}))
