import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  userId: number | null
  orgId: number | null
  email: string | null
  role: string | null
  permissions: string[]
  login: (userId: number, orgId: number, email: string, role: string, permissions: string[]) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      orgId: null,
      email: null,
      role: null,
      permissions: [],
      login: (userId, orgId, email, role, permissions) => set({ isAuthenticated: true, userId, orgId, email, role, permissions }),
      logout: () => set({ isAuthenticated: false, userId: null, orgId: null, email: null, role: null, permissions: [] })
    }),
    {
      name: 'auth-storage'
    }
  )
)
