import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { LeadEntity } from './LeadEntity'
import type { ActivityEvent } from '../../../shared/types/activity.types'

@Entity('activity')
export class ActivityEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'int' })
  lead_id!: number

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadEntity

  @Column({ type: 'text' })
  event!: ActivityEvent

  @Column({ type: 'text', nullable: true })
  detail!: string | null

  @CreateDateColumn()
  created_at!: Date
}
