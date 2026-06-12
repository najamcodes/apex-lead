// src/store/theme.store.ts
import { create } from 'zustand'

interface ThemeState {
  theme: 'dark' | 'light'
  initTheme: () => Promise<void>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',

  initTheme: async () => {
    const settings = await window.api.settings.get()
    const theme = settings.theme || 'dark'
    set({ theme })
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  },

  setTheme: async (theme) => {
    set({ theme })
    await window.api.settings.save({ theme })
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }
}))
