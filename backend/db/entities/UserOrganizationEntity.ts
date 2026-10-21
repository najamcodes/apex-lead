import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { UserEntity } from './UserEntity'
import { OrganizationEntity } from './OrganizationEntity'

export type OrgMemberRole = 'owner' | 'admin' | 'org_admin' | 'manager' | 'user' | 'viewer'

export const ORG_MEMBER_ROLE_HIERARCHY: Record<OrgMemberRole, number> = {
  owner: 4,
  admin: 4,
  org_admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
}

export function orgMemberRoleLevel(role: string): number {
  return ORG_MEMBER_ROLE_HIERARCHY[role as OrgMemberRole] ?? 1
}

export function canManageOrgAsMember(role: string): boolean {
  return orgMemberRoleLevel(role) >= 4
}

export function canViewAllDataAsMember(role: string): boolean {
  return orgMemberRoleLevel(role) >= 3
}

export function canRunPipelineAsMember(role: string): boolean {
  return orgMemberRoleLevel(role) >= 2
}

@Entity('user_organizations')
@Index(['user_id', 'org_id'], { unique: true })
export class UserOrganizationEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int' })
  user_id!: number

  @Column({ type: 'int' })
  org_id!: number

  @Column({ type: 'text', default: 'user' })
  role!: string

  @Column({ type: 'text', default: '[]' })
  permissions!: string

  @Column({ type: 'boolean', default: false })
  is_default!: boolean

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity

  @ManyToOne(() => OrganizationEntity)
  @JoinColumn({ name: 'org_id' })
  org!: OrganizationEntity
}