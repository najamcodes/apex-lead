import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('digest_runs')
export class DigestRunEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text', default: () => "(datetime('now'))" })
  run_at!: string

  @Column({ type: 'int', default: 0 })
  targets_run!: number

  @Column({ type: 'int', default: 0 })
  total_scraped!: number

  @Column({ type: 'int', default: 0 })
  total_qualified!: number

  @Column({ type: 'int', default: 0 })
  total_no_website!: number

  @Column({ type: 'int', default: 0 })
  total_new!: number

  @Column({ type: 'boolean', default: false })
  digest_sent!: boolean

  @Column({ type: 'text', nullable: true })
  digest_error!: string | null

  @Column({ type: 'text', default: '[]' })
  top_leads!: string
}
