import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('visitor_pageviews')
@Index('idx_pageviews_session', ['session_id'])
export class VisitorPageviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 36 })
  session_id!: string

  @Column({ type: 'varchar', length: 500 })
  path!: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer?: string

  @Column({ type: 'integer', default: 0 })
  duration_seconds!: number

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date
}
