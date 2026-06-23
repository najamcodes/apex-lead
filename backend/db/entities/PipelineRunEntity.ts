// backend/db/entities/PipelineRunEntity.ts
import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('pipeline_runs')
export class PipelineRunEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string

  @Column({ type: 'varchar', length: 100 })
  pipeline_id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status!: string // 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

  @Column({ type: 'varchar', length: 50 })
  started_at!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  completed_at!: string | null

  /** JSON-encoded input config. */
  @Column({ type: 'text', nullable: true })
  input!: string | null

  /** JSON-encoded per-node stats. */
  @Column({ type: 'text', nullable: true })
  stats!: string | null

  @Column({ type: 'text', nullable: true })
  error!: string | null

  /** JSON-encoded log lines (capped). */
  @Column({ type: 'text', nullable: true })
  log!: string | null
}
