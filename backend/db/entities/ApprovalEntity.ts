// backend/db/entities/ApprovalEntity.ts
// Entity storing pending Human-in-the-Loop approval checkpoints for pipelines.

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout'

@Entity('pipeline_approvals')
@Index('idx_approvals_org_status', ['org_id', 'status'])
export class ApprovalEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text' })
  pipeline_id!: string

  @Column({ type: 'text' })
  run_id!: string

  @Column({ type: 'text' })
  node_id!: string

  @Column({ type: 'text', default: 'Human Approval' })
  node_label!: string

  @Column({ type: 'text' })
  records!: string // JSON array of pending records

  @Column({ type: 'text', nullable: true })
  modified_records!: string | null

  @Column({ type: 'text', default: 'pending' })
  status!: ApprovalStatus

  @Column({ type: 'text', nullable: true })
  reviewer_notes!: string | null

  @Column({ type: 'text', nullable: true })
  reviewed_by!: string | null

  @Column({ type: 'text', nullable: true })
  reviewed_at!: string | null

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
