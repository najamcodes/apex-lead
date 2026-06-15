import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'
import type { TargetStatus } from '../../types/pipeline.types'

@Entity('scrape_targets')
export class ScrapeTargetEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text', nullable: true })
  label!: string | null

  @Column({ type: 'text' })
  query!: string

  @Column({ type: 'text' })
  city!: string

  @Column({ type: 'text', default: 'United States' })
  country!: string

  @Column({ type: 'int', default: 50 })
  max_per_run!: number

  @Column({ type: 'int', default: 0 })
  min_ai_score!: number

  @Column({ type: 'text', default: 'all' })
  website_filter!: string

  @Column({ type: 'boolean', default: false })
  use_proxy!: boolean

  @Column({ type: 'text', default: 'active' })
  status!: TargetStatus

  @Column({ type: 'text', nullable: true })
  last_run_at!: string | null

  @Column({ type: 'text', nullable: true })
  next_run_at!: string | null

  @Column({ type: 'int', default: 0 })
  total_found!: number

  @Column({ type: 'text', default: () => "(datetime('now'))" })
  created_at!: string
}
