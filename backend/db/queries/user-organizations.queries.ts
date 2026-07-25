import { getDataSource } from '../index'
import { UserOrganizationEntity } from '../entities/UserOrganizationEntity'
import { UserEntity } from '../entities/UserEntity'
import { getCurrentUserId } from './tenant'
import type { UserOrgInsert, UserOrgUpdate } from '../../../shared/types'

export async function getUserOrganizations(): Promise<UserOrganizationEntity[]> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  return await repo.find({ where: { user_id: getCurrentUserId() }, order: { created_at: 'DESC' } })
}

export async function getUserOrganization(orgId: number): Promise<UserOrganizationEntity | null> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  return await repo.findOne({ where: { user_id: getCurrentUserId(), org_id: orgId } })
}

export async function getOrganizationMembers(orgId: number): Promise<UserOrganizationEntity[]> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  return await repo.find({
    where: { org_id: orgId },
    relations: { user: true },
    order: { created_at: 'ASC' }
  })
}

export async function addUserToOrganization(data: UserOrgInsert): Promise<UserOrganizationEntity> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  const link = repo.create({ 
    ...data, 
    user_id: data.user_id, 
    org_id: data.org_id, 
    role: data.role || 'user',
    permissions: JSON.stringify(data.permissions || [])
  })
  return await repo.save(link)
}

export async function updateUserOrganization(orgId: number, userId: number, data: UserOrgUpdate): Promise<UserOrganizationEntity | null> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  const link = await repo.findOne({ where: { org_id: orgId, user_id: userId } })
  if (!link) return null
  Object.assign(link, data)
  return await repo.save(link)
}

export async function removeUserFromOrganization(orgId: number, userId: number): Promise<boolean> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  const result = await repo.delete({ org_id: orgId, user_id: userId })
  return (result.affected ?? 0) > 0
}

export async function getCurrentUserOrgRole(orgId: number): Promise<string | null> {
  const link = await getUserOrganization(orgId)
  return link?.role ?? null
}

export async function setCurrentOrganization(orgId: number): Promise<void> {
  const link = await getUserOrganization(orgId)
  if (!link) throw new Error('User is not a member of this organization')
  
  // Update user's default org
  const userRepo = getDataSource().getRepository(UserEntity)
  await userRepo.update(getCurrentUserId(), { default_org_id: orgId })
  
  // Update global context
  global.currentOrgId = orgId
  global.currentUserRole = link.role
}

export async function getOrganizationsForUser(userId: number): Promise<UserOrganizationEntity[]> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  return await repo.find({
    where: { user_id: userId },
    relations: { org: true },
    order: { created_at: 'DESC' }
  })
}

export async function isUserInOrg(userId: number, orgId: number): Promise<boolean> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  const link = await repo.findOne({ where: { user_id: userId, org_id: orgId } })
  return !!link
}

export async function getUserRoleInOrg(userId: number, orgId: number): Promise<string | null> {
  const repo = getDataSource().getRepository(UserOrganizationEntity)
  const link = await repo.findOne({ where: { user_id: userId, org_id: orgId } })
  return link?.role ?? null
}