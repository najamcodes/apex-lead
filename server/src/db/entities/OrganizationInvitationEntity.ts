import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { OrganizationEntity } from './OrganizationEntity'

export type OrgRole = 'owner' | 'admin' | 'manager' | 'user' | 'viewer'

const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'))

@Entity('organization_invitations')
@Index(['token'], { unique: true })
@Index(['org_id', 'email'])
export class OrganizationInvitationEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int' })
  @Index()
  org_id!: number

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization?: OrganizationEntity

  @Column({ type: 'text' })
  email!: string

  @Column({ type: 'text', default: 'user' })
  role!: OrgRole

  @Column({ type: 'text', unique: true })
  token!: string

  @Column({ type: isPostgres ? 'timestamp with time zone' : 'datetime' })
  expires_at!: Date

  @Column({ type: 'boolean', default: false })
  accepted!: boolean

  @Column({ type: 'int', nullable: true })
  invited_by_user_id!: number | null

  @CreateDateColumn()
  created_at!: Date
}
