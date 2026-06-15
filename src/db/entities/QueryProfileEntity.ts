import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'
import type { QueryProfileStatus } from '../../types/pipeline.types'

@Entity('query_profiles')
export class QueryProfileEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text' })
  label!: string

  @Column({ type: 'text' })
  target_audience!: string

  @Column({ type: 'text' })
  core_offer!: string

  @Column({ type: 'text' })
  cities!: string // JSON array

  @Column({ type: 'text' })
  countries!: string // JSON array

  @Column({ type: 'text', default: 'active' })
  status!: QueryProfileStatus

  @Column({ type: 'int', default: 0 })
  queries_generated!: number

  @Column({ type: 'text', default: () => "datetime('now')" })
  created_at!: string

  @Column({ type: 'text', default: () => "datetime('now')" })
  updated_at!: string
}
