// backend/db/entities/PipelineDefinitionEntity.ts
import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('pipeline_definitions')
export class PipelineDefinitionEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'varchar', length: 100 })
  collection!: string

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: string // 'active' | 'paused' | 'draft'

  /** JSON-encoded: { nodes: [...], edges: [...] } */
  @Column({ type: 'text' })
  graph!: string

  /** JSON-encoded trigger config. */
  @Column({ type: 'text', nullable: true })
  trigger!: string | null

  @Column({ type: 'integer', default: 1 })
  version!: number

  /** Proxy configuration id for this pipeline (null = use default/no proxy). */
  @Column({ type: 'int', nullable: true })
  proxy_id!: number | null

  /** Minimum role required to run this pipeline (default 'user'). */
  @Column({ type: 'varchar', length: 20, default: 'user' })
  min_role!: string

  /** JSON-encoded per-node role gates: { nodeId: minRole }. */
  @Column({ type: 'text', nullable: true })
  role_gates!: string | null

  @Column({ type: 'varchar', length: 50 })
  created_at!: string

  @Column({ type: 'varchar', length: 50 })
  updated_at!: string
}
