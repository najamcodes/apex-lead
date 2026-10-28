import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('visitor_sessions')
@Index('idx_visitor_sessions_site_intent', ['site_id', 'intent_score'])
export class VisitorSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 36 })
  site_id!: string

  @Column({ type: 'varchar', length: 45 })
  ip_address!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  company_name?: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  company_domain?: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  company_industry?: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  company_size?: string

  @Column({ type: 'integer', default: 10 })
  intent_score!: number

  @Column({ type: 'integer', default: 1 })
  pageview_count!: number

  @Column({ type: 'boolean', default: false })
  visited_pricing!: boolean

  @CreateDateColumn({ type: 'datetime' })
  started_at!: Date

  @UpdateDateColumn({ type: 'datetime' })
  last_active_at!: Date
}
