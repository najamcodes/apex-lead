import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export type UserRole = 'super_admin' | 'org_admin' | 'manager' | 'user' | 'viewer'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 5,
  org_admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
}

export function roleLevel(role: string): number {
  return ROLE_HIERARCHY[role as UserRole] ?? 1
}

export function canManageOrg(role: string): boolean {
  return roleLevel(role) >= 4
}

export function canViewAllData(role: string): boolean {
  return roleLevel(role) >= 3
}

export function canRunPipeline(role: string): boolean {
  return roleLevel(role) >= 2
}

@Entity('users')
@Index(['default_org_id'])
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text', unique: true })
  email!: string

  @Column({ type: 'text' })
  password_hash!: string

  @Column({ type: 'int', nullable: true })
  default_org_id!: number | null

  @Column({ type: 'text', default: 'user' })
  role!: string

  @Column({ type: 'text', default: '[]' })
  permissions!: string

  @Column({ type: 'text', nullable: true })
  name!: string | null

  @Column({ type: 'text', nullable: true })
  avatar_url!: string | null

  @Column({ type: 'int', default: 0 })
  hierarchy_level!: number

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}