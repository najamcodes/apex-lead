import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('cadences')
@Index('idx_cadences_org', ['org_id'])
export class CadenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status!: string // 'draft' | 'active' | 'paused' | 'archived'

  @Column({ type: 'integer', default: 100 })
  daily_limit!: number

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date
}
