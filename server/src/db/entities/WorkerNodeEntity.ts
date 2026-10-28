// backend/db/entities/WorkerNodeEntity.ts
// Represents a connected or registered child desktop worker node in the farm.

import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export type WorkerStatus = 'online' | 'busy' | 'idle' | 'offline'

@Entity('worker_nodes')
@Index(['org_id'])
@Index(['status'])
export class WorkerNodeEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string // UUID or unique worker client identifier

  @Column({ type: 'int' })
  org_id!: number

  @Column({ type: 'int', nullable: true })
  user_id!: number | null

  @Column({ type: 'text' })
  name!: string // Human readable name e.g. "Najam's Windows PC"

  @Column({ type: 'text', nullable: true })
  hostname!: string | null

  @Column({ type: 'text', default: 'unknown' })
  platform!: string // 'win32', 'darwin', 'linux'

  @Column({ type: 'text', default: 'offline' })
  status!: WorkerStatus

  @Column({ type: 'text', default: '[]' })
  capabilities!: string // JSON array e.g. ["google_maps", "browser", "pipeline_executor"]

  @Column({ type: 'int', default: 2 })
  max_concurrency!: number

  @Column({ type: 'int', default: 0 })
  active_jobs!: number

  @Column({ type: 'text', nullable: true })
  ip_address!: string | null

  @Column({ type: 'text', nullable: true })
  version!: string | null

  @Column({ type: 'text', nullable: true })
  last_heartbeat_at!: string | null

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
