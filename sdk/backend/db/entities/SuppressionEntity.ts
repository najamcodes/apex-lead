import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm'

export type SuppressionType = 'email' | 'domain' | 'phone'
export type SuppressionReason = 'unsubscribed' | 'manual' | 'bounced' | 'complaint'

@Entity('suppressions')
@Index('idx_suppressions_org_val', ['org_id', 'value'], { unique: true })
export class SuppressionEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text', default: 'email' })
  type!: SuppressionType

  @Column({ type: 'text' })
  value!: string

  @Column({ type: 'text', default: 'manual' })
  reason!: SuppressionReason

  @CreateDateColumn()
  created_at!: Date
}
