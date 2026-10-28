import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestUser {
  id: number
  org_id: number
  role: string
  permissions: string[]
  name?: string | null
  email?: string
}

const requestContext = new AsyncLocalStorage<Map<string, RequestUser>>()

export function getRequestUser(): RequestUser | undefined {
  const store = requestContext.getStore()
  if (!store) return undefined
  const user = store.get('user')
  return user
}

export function runWithUser<R = unknown>(user: RequestUser, fn: () => R): R {
  const store = new Map<string, RequestUser>()
  store.set('user', user)
  return requestContext.run(store, fn)
}

export function getTenantId(): number {
  const user = getRequestUser()
  return user?.org_id ?? 1
}

export function getCurrentUserId(): number {
  const user = getRequestUser()
  return user?.id ?? 1
}

export function getCurrentUserRole(): string {
  return getRequestUser()?.role ?? 'user'
}

export function getCurrentUserPermissions(): string[] {
  return getRequestUser()?.permissions ?? []
}

export function getCurrentOrgId(): number {
  return getTenantId()
}

export function canManageOrg(): boolean {
  const role = getCurrentUserRole()
  return role === 'admin' || role === 'owner' || role === 'super_admin'
}

