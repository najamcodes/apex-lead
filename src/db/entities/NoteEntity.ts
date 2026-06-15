import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { LeadEntity } from './LeadEntity'

@Entity('notes')
export class NoteEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'int' })
  lead_id!: number

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadEntity

  @Column({ type: 'text', default: '' })
  body!: string

  @Column({ type: 'text', default: () => "datetime('now')" })
  created_at!: string

  @Column({ type: 'text', default: () => "datetime('now')" })
  updated_at!: string
}
