// src/db/queries/tenant.ts
// Electron uses globals; server uses AsyncLocalStorage via server/src/context.ts

declare global {
  var currentUserId: number | undefined;
  var currentOrgId: number | undefined;
  var currentUserRole: string | undefined;
  var currentUserPermissions: string[] | undefined;
}

export function getTenantId(): number {
  return global.currentOrgId || 1
}

export function getCurrentUserId(): number {
  return global.currentUserId || 1
}

export function getCurrentUserRole(): string {
  return global.currentUserRole || 'admin'
}

export function getCurrentUserPermissions(): string[] {
  return global.currentUserPermissions || ['*']
}

export function getCurrentOrgId(): number {
  return getTenantId()
}

export function setCurrentOrgId(orgId: number): void {
  global.currentOrgId = orgId
}

export function setCurrentUserRole(role: string): void {
  global.currentUserRole = role
}

// ─── Role hierarchy ───────────────────────────────────────────────
// System roles (for super_admin)
const SYSTEM_ROLE_LEVELS: Record<string, number> = {
  super_admin: 5,
}

// Organization member roles
const ORG_ROLE_LEVELS: Record<string, number> = {
  owner: 4,
  admin: 4,
  org_admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
}

export function roleLevel(role: string): number {
  return SYSTEM_ROLE_LEVELS[role] ?? ORG_ROLE_LEVELS[role] ?? 1
}

export function isSystemRole(role: string): boolean {
  return role in SYSTEM_ROLE_LEVELS
}

export function isOrgRole(role: string): boolean {
  return role in ORG_ROLE_LEVELS
}

export function hasPermission(permission: string, role?: string, perms?: string[]): boolean {
  const r = role ?? getCurrentUserRole()
  if (roleLevel(r) >= 4) return true // super_admin, owner, admin, & org_admin have all permissions
  if (roleLevel(r) >= 3) {
    // managers have operational permissions by default
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

  const p = perms ?? getCurrentUserPermissions()
  return p.includes(permission) || p.includes('*') || p.includes('all')
}

export function requirePermission(permission: string, role?: string, perms?: string[]): void {
  if (!hasPermission(permission, role, perms)) {
    throw new Error(`Unauthorized: Missing permission ${permission}`)
  }
}

export function canViewPipelines(role?: string, perms?: string[]): boolean {
  const r = role ?? getCurrentUserRole()
  if (process.env.NODE_ENV === 'desktop' && roleLevel(r) >= 2) return true
  return hasPermission('view_pipelines', role, perms) || roleLevel(r) >= 2
}

export function canRunPipelines(role?: string, perms?: string[]): boolean {
  const r = role ?? getCurrentUserRole()
  if (process.env.NODE_ENV === 'desktop' && roleLevel(r) >= 2) return true
  return hasPermission('run_pipelines', role, perms) || roleLevel(r) >= 2
}

export function canEditPipelines(role?: string, perms?: string[]): boolean {
  const r = role ?? getCurrentUserRole()
  if (process.env.NODE_ENV === 'desktop' && roleLevel(r) >= 2) return true
  return hasPermission('edit_pipelines', role, perms) || roleLevel(r) >= 3
}

export function canManagePlugins(role?: string, perms?: string[]): boolean {
  return hasPermission('manage_plugins', role, perms) || roleLevel(role ?? getCurrentUserRole()) >= 3
}

export function canApproveRuns(role?: string, perms?: string[]): boolean {
  return hasPermission('approve_runs', role, perms) || roleLevel(role ?? getCurrentUserRole()) >= 3
}

export function canManageOrg(role?: string): boolean {
  const r = role ?? getCurrentUserRole()
  return roleLevel(r) >= 4
}

export function canViewAllData(role?: string): boolean {
  const r = role ?? getCurrentUserRole()
  return roleLevel(r) >= 3
}

export function canRunPipeline(role?: string): boolean {
  return canRunPipelines(role)
}

export function isRoleBelow(minRole: string): boolean {
  return roleLevel(getCurrentUserRole()) < roleLevel(minRole)
}

/** Returns SQL fragment and params for user-scoped data filtering.
 *  Admins/managers see all org data; users/viewers see only their own. */
export function getUserScopeFilter(alias: string = ''): { clause: string; params: Record<string, unknown> } {
  if (canViewAllData()) {
    return { clause: '', params: {} }
  }
  const col = alias ? `${alias}.scraped_by_user_id` : 'scraped_by_user_id'
  return {
    clause: `AND ${col} = :scrapedByUserId`,
    params: { scrapedByUserId: getCurrentUserId() },
  }
}