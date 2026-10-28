import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { LeadEntity } from './LeadEntity'
import type { OutreachStatus } from '@sdk/core/types/outreach.types'

@Entity('outreach')
export class OutreachEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'int' })
  lead_id!: number

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadEntity

  @Column({ type: 'int', default: 1 })
  step!: number

  @Column({ type: 'text', default: 'email' })
  channel!: string

  @Column({ type: 'text', nullable: true })
  subject!: string | null

  @Column({ type: 'text', default: '' })
  body!: string

  @Column({ type: 'text', default: 'queued' })
  status!: OutreachStatus

  @Column({ type: 'text' })
  scheduled_at!: string

  @Column({ type: 'text', nullable: true })
  sent_at!: string | null

  @Column({ type: 'text', nullable: true })
  opened_at!: string | null

  @Column({ type: 'text', nullable: true })
  replied_at!: string | null

  @Column({ type: 'text', nullable: true })
  error_message!: string | null

  @Column({ type: 'text', nullable: true })
  smtp_message_id!: string | null

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
