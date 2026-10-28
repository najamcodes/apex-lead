import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('voice_calls')
@Index('idx_voice_calls_org_record', ['org_id', 'record_id'])
@Index('idx_voice_calls_sid', ['call_sid'])
export class VoiceCallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 36 })
  campaign_id!: string

  @Column({ type: 'varchar', length: 100 })
  record_id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 255 })
  call_sid!: string

  @Column({ type: 'varchar', length: 50 })
  recipient_phone!: string

  @Column({ type: 'varchar', length: 50, default: 'initiated' })
  status!: string // 'initiated' | 'in_progress' | 'completed' | 'busy' | 'no_answer' | 'failed'

  @Column({ type: 'integer', default: 0 })
  duration_seconds!: number

  @Column({ type: 'text', nullable: true })
  transcript?: string

  @Column({ type: 'text', nullable: true })
  summary?: string

  @Column({ type: 'float', nullable: true })
  sentiment_score?: number // -1.00 to 1.00

  @Column({ type: 'boolean', default: false })
  appointment_booked!: boolean

  @Column({ type: 'datetime', nullable: true })
  appointment_time?: Date

  @Column({ type: 'text', default: '{}' })
  qualification_answers!: string // JSON serialized

  @Column({ type: 'text', nullable: true })
  recording_url?: string

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date

  @Column({ type: 'datetime', nullable: true })
  finished_at?: Date
}
