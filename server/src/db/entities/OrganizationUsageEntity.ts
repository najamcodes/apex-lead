import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index, Unique } from 'typeorm'

@Entity('organization_usage')
@Unique(['org_id', 'billing_period'])
export class OrganizationUsageEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ type: 'int' })
  @Index()
  org_id!: number

  @Column({ type: 'varchar', length: 7 })
  billing_period!: string

  @Column({ type: 'int', default: 0 })
  leads_exported!: number

  @Column({ type: 'int', default: 0 })
  cloud_scrapes_executed!: number

  @Column({ type: 'int', default: 0 })
  waterfall_checks_used!: number

  @Column({ type: 'int', default: 0 })
  ai_tokens_used!: number

  @UpdateDateColumn()
  updated_at!: Date
}
