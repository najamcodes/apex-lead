// src/store/theme.store.ts
import { create } from 'zustand'
import { api } from '../services/api'

interface ThemeState {
  theme: 'dark' | 'light'
  initTheme: () => Promise<void>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',

  initTheme: async () => {
    try {
      const settings = await api.settings.get()
      const theme = settings?.theme || 'dark'
      set({ theme })
      if (theme === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
    } catch {
      // Default to dark theme if unauthenticated or network error
      set({ theme: 'dark' })
      document.documentElement.classList.remove('light')
    }
  },

  setTheme: async (theme) => {
    set({ theme })
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    try {
      await api.settings.save({ theme })
    } catch {
      // Silently ignore save failure if not authenticated yet
    }
  }
}))
