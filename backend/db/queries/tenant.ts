// src/db/queries/tenant.ts
// Electron uses globals; server uses AsyncLocalStorage via server/src/context.ts

declare global {
  var currentUserId: number | undefined;
  var currentOrgId: number | undefined;
  var currentUserRole: string | undefined;
  var currentUserPermissions: string[] | undefined;
}

function getAsyncUser(): { orgId: number; userId: number; role: string; permissions: string[] } | undefined {
  try {
    const { getRequestUser } = require('../../server/src/context')
    const user = getRequestUser()
    if (user) return { orgId: user.org_id, userId: user.id, role: user.role, permissions: user.permissions }
  } catch {
    // Not running in server context
  }
  return undefined
}

export function getTenantId(): number {
  const asyncUser = getAsyncUser()
  if (asyncUser) return asyncUser.orgId
  return global.currentOrgId || 1
}

export function getCurrentUserId(): number {
  const asyncUser = getAsyncUser()
  if (asyncUser) return asyncUser.userId
  return global.currentUserId || 1
}

export function getCurrentUserRole(): string {
  const asyncUser = getAsyncUser()
  if (asyncUser) return asyncUser.role
  return global.currentUserRole || 'user'
}

export function getCurrentUserPermissions(): string[] {
  const asyncUser = getAsyncUser()
  if (asyncUser) return asyncUser.permissions
  return global.currentUserPermissions || []
}
