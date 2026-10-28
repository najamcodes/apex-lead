import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('audit_logs')
@Index('idx_audit_logs_org_created', ['org_id', 'created_at'])
@Index('idx_audit_logs_resource', ['resource_type', 'resource_id'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'int', nullable: true })
  user_id!: number | null

  @Column({ type: 'varchar', length: 100 })
  action!: string

  @Column({ type: 'varchar', length: 100 })
  resource_type!: string

  @Column({ type: 'varchar', length: 255 })
  resource_id!: string

  @Column({ type: 'text', nullable: true })
  metadata!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip_address!: string | null

  @CreateDateColumn()
  created_at!: Date
}
