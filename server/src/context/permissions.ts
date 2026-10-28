export const ROLE_LEVELS = {
  super_admin: 6,
  owner: 5,
  admin: 4,
  org_admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
} as const

export type RoleName = keyof typeof ROLE_LEVELS

export function hasPermission(userRole: string | undefined | null, requiredRole: RoleName): boolean {
  if (!userRole) return false
  const userLevel = ROLE_LEVELS[userRole as RoleName] ?? 0
  const reqLevel = ROLE_LEVELS[requiredRole] ?? 99
  return userLevel >= reqLevel
}
