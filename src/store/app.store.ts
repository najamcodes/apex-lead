// src/store/app.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  sidebarCollapsed: boolean
  activeRoute: string
  toggleSidebar: () => void
  setActiveRoute: (route: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeRoute: '/dashboard',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveRoute: (route) => set({ activeRoute: route }),
    }),
    { name: 'leadhunter-app-state' }
  )
)
