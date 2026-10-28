import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('enrichment_cache')
@Index('idx_enrichment_lookup', ['domain', 'first_name', 'last_name'])
export class EnrichmentCacheEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 255 })
  domain!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  first_name?: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  last_name?: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  resolved_email?: string

  @Column({ type: 'varchar', length: 50, default: 'unknown' })
  email_status!: string // 'verified' | 'catch_all' | 'undeliverable' | 'unknown'

  @Column({ type: 'varchar', length: 50, nullable: true })
  resolved_phone?: string

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone_type?: string // 'mobile' | 'landline' | 'voip'

  @Column({ type: 'float', default: 0.0 })
  confidence_score!: number

  @Column({ type: 'varchar', length: 50 })
  provider_source!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  mx_record?: string

  @Column({ type: 'boolean', default: false })
  smtp_check_passed!: boolean

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date

  @Column({ type: 'datetime', nullable: true })
  expires_at?: Date
}
