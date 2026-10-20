import { getDataSource } from '../index'
import { UserEntity } from '../entities/UserEntity'
import { UserOrganizationEntity } from '../entities/UserOrganizationEntity'
import { getTenantId, getCurrentUserRole, canManageOrg, roleLevel } from './tenant'
import { hashPassword } from '@sdk/core/utils/crypto'

/**
 * Get all users who are members of the current org, by joining user_organizations.
 * Returns user objects with the org-specific role, not the global user role.
 */
export async function getUsersInOrg(): Promise<Array<UserEntity & { org_role: string; org_permissions: string[] }>> {
  if (!canManageOrg()) throw new Error('Unauthorized')
  const ds = getDataSource()
  const orgId = getTenantId()

  const links = await ds.getRepository(UserOrganizationEntity).find({
    where: { org_id: orgId },
    relations: { user: true },
    order: { created_at: 'ASC' },
  })

  return links.map(link => ({
    ...(link.user as UserEntity),
    password_hash: '', // never expose
    org_role: link.role,
    org_permissions: (() => {
      try { return JSON.parse(link.permissions || '[]') } catch { return [] }
    })(),
  }))
}

export async function updateUserPermissions(userId: number, permissions: string[]): Promise<void> {
  if (!canManageOrg()) throw new Error('Unauthorized')
  const ds = getDataSource()
  const orgId = getTenantId()

  // Update permissions in user_organizations (org-scoped)
  const link = await ds.getRepository(UserOrganizationEntity).findOne({
    where: { user_id: userId, org_id: orgId },
  })
  if (!link) throw new Error('User not found in this organization')
  if (link.role === 'org_admin') throw new Error('Cannot modify org_admin permissions directly')

  link.permissions = JSON.stringify(permissions)
  await ds.getRepository(UserOrganizationEntity).save(link)
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
  if (!canManageOrg()) throw new Error('Unauthorized')
  if (roleLevel(role) >= roleLevel(getCurrentUserRole())) {
    throw new Error('Cannot assign a role equal to or higher than your own')
  }
  const ds = getDataSource()
  const orgId = getTenantId()

  // Update role in user_organizations (org-scoped)
  const link = await ds.getRepository(UserOrganizationEntity).findOne({
    where: { user_id: userId, org_id: orgId },
  })
  if (!link) throw new Error('User not found in this organization')

  link.role = role
  await ds.getRepository(UserOrganizationEntity).save(link)

  // Also update global user role for consistency (e.g., hierarchy_level)
  const user = await ds.getRepository(UserEntity).findOne({ where: { id: userId } })
  if (user) {
    user.hierarchy_level = roleLevel(role)
    user.updated_at = new Date()
    await ds.getRepository(UserEntity).save(user)
  }
}

export async function createTeamMember(
  email: string,
  password: string,
  role: string = 'user',
  name?: string
): Promise<UserEntity> {
  if (!canManageOrg()) throw new Error('Unauthorized')
  if (roleLevel(role) >= roleLevel(getCurrentUserRole())) {
    throw new Error('Cannot create a user with a role equal to or higher than your own')
  }
  const ds = getDataSource()
  const orgId = getTenantId()

  const existing = await ds.getRepository(UserEntity).findOneBy({ email })
  if (existing) throw new Error('Email already registered')

  // Create user record
  const user = ds.getRepository(UserEntity).create({
    email,
    password_hash: hashPassword(password),
    role,
    default_org_id: orgId,
    permissions: '[]',
    name: name ?? null,
    hierarchy_level: roleLevel(role),
  })
  await ds.getRepository(UserEntity).save(user)

  // Create org membership link
  const link = ds.getRepository(UserOrganizationEntity).create({
    user_id: user.id,
    org_id: orgId,
    role,
    permissions: '[]',
    is_default: true,
  })
  await ds.getRepository(UserOrganizationEntity).save(link)

  return user
}

export async function deleteUser(userId: number): Promise<void> {
  if (!canManageOrg()) throw new Error('Unauthorized')
  const ds = getDataSource()
  const orgId = getTenantId()

  // Only remove from org if they have other orgs; otherwise delete entirely
  const allLinks = await ds.getRepository(UserOrganizationEntity).find({ where: { user_id: userId } })
  const thisOrgLink = allLinks.find(l => l.org_id === orgId)
  if (!thisOrgLink) throw new Error('User not found in this organization')
  if (thisOrgLink.role === 'org_admin') throw new Error('Cannot remove org admin')

  // Remove org membership
  await ds.getRepository(UserOrganizationEntity).delete({ user_id: userId, org_id: orgId })

  // If user has no more orgs, delete the user entirely
  if (allLinks.length <= 1) {
    await ds.getRepository(UserEntity).delete({ id: userId })
  }
}
