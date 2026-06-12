import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { LeadEntity } from './LeadEntity'
import type { ActivityEvent } from '../../types/activity.types'

@Entity('activity')
export class ActivityEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int' })
  lead_id!: number

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadEntity

  @Column({ type: 'text' })
  event!: ActivityEvent

  @Column({ type: 'text', nullable: true })
  detail!: string | null

  @Column({ type: 'text', default: () => "datetime('now')" })
  created_at!: string
}
