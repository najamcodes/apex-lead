import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('scrape_jobs')
export class ScrapeJobEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string

  @Column({ type: 'int', default: 1 })
  org_id!: number


  @Column({ type: 'text' })
  query!: string

  @Column({ type: 'text' })
  city!: string

  @Column({ type: 'text', default: '' })
  country!: string

  @Column({ type: 'int', default: 100 })
  max_results!: number

  @Column({ type: 'text', default: 'idle' })
  status!: string

  @Column({ type: 'int', default: 0 })
  progress!: number

  @Column({ type: 'int', default: 0 })
  found!: number

  @Column({ type: 'int', default: 0 })
  errors!: number

  @Column({ type: 'text', nullable: true })
  started_at!: string | null

  @Column({ type: 'text', nullable: true })
  completed_at!: string | null

  @Column({ type: 'text', nullable: true })
  error_message!: string | null
}
