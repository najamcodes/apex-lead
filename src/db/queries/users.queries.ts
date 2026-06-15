import { getDataSource } from '../index'
import { UserEntity } from '../entities/UserEntity'
import { getTenantId, getCurrentUserRole } from './tenant'
import crypto from 'crypto'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export async function getUsersInOrg(): Promise<UserEntity[]> {
  if (getCurrentUserRole() !== 'admin') throw new Error('Unauthorized');
  const repo = getDataSource().getRepository(UserEntity)
  // Mask passwords
  const users = await repo.find({ where: { org_id: getTenantId() } })
  return users.map(u => ({ ...u, password_hash: '' } as UserEntity))
}

export async function updateUserPermissions(userId: number, permissions: string[]): Promise<void> {
  if (getCurrentUserRole() !== 'admin') throw new Error('Unauthorized');
  const repo = getDataSource().getRepository(UserEntity)
  const user = await repo.findOne({ where: { id: userId, org_id: getTenantId() } })
  if (!user) throw new Error('User not found')

  // Don't allow removing permissions from admin
  if (user.role === 'admin') throw new Error('Cannot modify admin permissions directly')

  user.permissions = JSON.stringify(permissions)
  await repo.save(user)
}

export async function createTeamMember(email: string, password: string): Promise<UserEntity> {
  if (getCurrentUserRole() !== 'admin') throw new Error('Unauthorized');
  const repo = getDataSource().getRepository(UserEntity)
  
  const existing = await repo.findOneBy({ email })
  if (existing) throw new Error('Email already registered')

  const user = repo.create({
    email,
    password_hash: hashPassword(password),
    role: 'user',
    org_id: getTenantId(),
    permissions: '[]' // Explicitly empty initially
  })

  await repo.save(user)
  return user
}

export async function deleteUser(userId: number): Promise<void> {
  if (getCurrentUserRole() !== 'admin') throw new Error('Unauthorized');
  const repo = getDataSource().getRepository(UserEntity)
  const user = await repo.findOne({ where: { id: userId, org_id: getTenantId() } })
  if (!user) throw new Error('User not found')
  if (user.role === 'admin') throw new Error('Cannot delete admin user')

  await repo.remove(user)
}
