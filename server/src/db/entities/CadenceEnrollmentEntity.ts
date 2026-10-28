import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm'

@Entity('cadence_enrollments')
@Unique('uq_cadence_record', ['cadence_id', 'record_id'])
@Index('idx_cadence_due_jobs', ['status', 'next_send_at'])
export class CadenceEnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 36 })
  cadence_id!: string

  @Column({ type: 'varchar', length: 36 })
  record_id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'integer', default: 1 })
  current_step!: number

  @Column({ type: 'varchar', length: 50, default: 'queued' })
  status!: string // 'queued' | 'in_progress' | 'replied' | 'bounced' | 'completed' | 'paused'

  @Column({ type: 'datetime' })
  next_send_at!: Date

  @Column({ type: 'varchar', length: 255 })
  recipient_email!: string

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date
}
