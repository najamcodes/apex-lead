import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export type OrgTier = 'free' | 'starter' | 'pro' | 'enterprise'

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', default: 'free' })
  tier!: string

  @Column({ type: 'text', default: '{}' })
  settings!: string

  @Column({ type: 'text', nullable: true })
  billing_email!: string | null

  @Column({ type: 'text', nullable: true })
  logo_url!: string | null

  @Column({ type: 'int', default: 5 })
  max_users!: number

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
