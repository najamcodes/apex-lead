import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm'

@Entity('mailboxes')
@Unique('uq_org_email', ['org_id', 'email'])
@Index('idx_mailboxes_org_status', ['org_id', 'status'])
export class MailboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 255 })
  email!: string

  @Column({ type: 'varchar', length: 100 })
  from_name!: string

  @Column({ type: 'varchar', length: 50, default: 'custom_smtp' })
  provider!: string // 'google' | 'microsoft' | 'custom_smtp'

  @Column({ type: 'varchar', length: 255 })
  smtp_host!: string

  @Column({ type: 'integer', default: 587 })
  smtp_port!: number

  @Column({ type: 'varchar', length: 255 })
  smtp_username!: string

  @Column({ type: 'text' })
  smtp_password_encrypted!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  imap_host?: string

  @Column({ type: 'integer', default: 993, nullable: true })
  imap_port?: number

  @Column({ type: 'integer', default: 40 })
  daily_quota!: number

  @Column({ type: 'integer', default: 0 })
  current_day_sends!: number

  @Column({ type: 'boolean', default: true })
  warmup_enabled!: boolean

  @Column({ type: 'integer', default: 1 })
  warmup_day!: number

  @Column({ type: 'integer', default: 100 })
  reputation_score!: number

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string // 'active' | 'warming' | 'paused' | 'error'

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date
}
