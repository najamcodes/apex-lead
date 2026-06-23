import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('digest_runs')
export class DigestRunEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @CreateDateColumn()
  run_at!: Date

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
