import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 5,
  owner: 4,
  admin: 4,
  org_admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
}

export function roleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 1
}

export function hasPermission(permission: string, role?: string | null, perms?: string[]): boolean {
  const r = role ?? 'user'
  if (roleLevel(r) >= 4) return true // super_admin, owner, admin, & org_admin have all permissions
  if (roleLevel(r) >= 3) {
    const managerDefaults = [
      'view_leads',
      'run_scraper',
      'send_outreach',
      'view_pipelines',
      'run_pipelines',
      'edit_pipelines',
      'manage_plugins',
      'approve_runs',
      'view_all_data',
    ]
    if (managerDefaults.includes(permission)) return true
  }

  const p = perms ?? []
  return p.includes(permission) || p.includes('*') || p.includes('all')
}

export function canManageOrg(role: string): boolean {
  return roleLevel(role) >= 4
}

export function canViewAllData(role: string): boolean {
  return roleLevel(role) >= 3
}

export function canViewPipelines(role?: string | null, perms?: string[]): boolean {
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).api)
  const r = role ?? 'user'
  if (isDesktop && roleLevel(r) >= 2) return true
  return hasPermission('view_pipelines', role, perms) || roleLevel(r) >= 2
}

export function canRunPipeline(role: string): boolean {
  return roleLevel(role) >= 2
}

export function canRunPipelines(role?: string | null, perms?: string[]): boolean {
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).api)
  const r = role ?? 'user'
  if (isDesktop && roleLevel(r) >= 2) return true
  return hasPermission('run_pipelines', role, perms) || roleLevel(r) >= 2
}

export function canEditPipelines(role?: string | null, perms?: string[]): boolean {
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).api)
  const r = role ?? 'user'
  if (isDesktop && roleLevel(r) >= 2) return true
  return hasPermission('edit_pipelines', role, perms) || roleLevel(r) >= 3
}

export function canManagePlugins(role?: string | null, perms?: string[]): boolean {
  return hasPermission('manage_plugins', role, perms) || roleLevel(role ?? 'user') >= 3
}

export function canApproveRuns(role?: string | null, perms?: string[]): boolean {
  return hasPermission('approve_runs', role, perms) || roleLevel(role ?? 'user') >= 3
}

interface Organization {
  id: number
  name: string
  tier: string
  role: string
}

interface AuthState {
  isAuthenticated: boolean
  userId: number | null
  orgId: number | null
  orgTier: string | null
  email: string | null
  role: string | null
  name: string | null
  permissions: string[]
  organizations: Organization[]
  login: (data: {
    userId: number
    orgId: number
    email: string
    role: string
    permissions: string[]
    name?: string | null
    organizations?: Organization[]
    orgTier?: string
  }) => void
  logout: () => void
  switchOrg: (orgId: number) => Promise<void>
  addOrganization: (org: Organization) => void
  removeOrganization: (orgId: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      userId: null,
      orgId: null,
      orgTier: null,
      email: null,
      role: null,
      name: null,
      permissions: [],
      organizations: [],
      
      login: (data) => set({
        isAuthenticated: true,
        userId: data.userId,
        orgId: data.orgId,
        email: data.email,
        role: data.role,
        permissions: data.permissions,
        name: data.name ?? null,
        organizations: data.organizations ?? [],
        orgTier: data.orgTier ?? null,
      }),
      
      logout: () => set({
        isAuthenticated: false,
        userId: null,
        orgId: null,
        orgTier: null,
        email: null,
        role: null,
        name: null,
        permissions: [],
        organizations: [],
      }),
      
      switchOrg: async (orgId: number) => {
        const { organizations } = get()
        const org = organizations.find(o => o.id === orgId)
        if (!org) throw new Error('Organization not found')
        
        // Update local state
        set({ orgId, role: org.role, orgTier: org.tier })
        
        // Call API to switch org on backend
        const res = await fetch('/api/orgs/switch', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Desktop-App': 'true',
            'X-User-Id': String(get().userId || ''),
            'X-Org-Id': String(orgId),
          },
          body: JSON.stringify({ org_id: orgId }),
        })
        
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to switch organization')
        }
        
        const data = await res.json()
        
        // Update token in cookie (handled by server via Set-Cookie)
        // Store new token if needed
        if (data.token) {
          document.cookie = `leadhunter_token=${data.token}; path=/; max-age=604800; SameSite=Lax`
        }
      },
      
      addOrganization: (org) => set((state) => ({
        organizations: [...state.organizations.filter(o => o.id !== org.id), org],
      })),
      
      removeOrganization: (orgId) => set((state) => ({
        organizations: state.organizations.filter(o => o.id !== orgId),
        orgId: state.orgId === orgId ? null : state.orgId,
      })),
    }),
    {
      name: 'auth-storage',
    }
  )
)