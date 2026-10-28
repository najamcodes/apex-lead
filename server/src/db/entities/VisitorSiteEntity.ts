import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm'

@Entity('visitor_sites')
@Unique('uq_site_key', ['api_key'])
@Index('idx_visitor_sites_org', ['org_id'])
export class VisitorSiteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 255 })
  domain!: string

  @Column({ type: 'varchar', length: 64 })
  api_key!: string

  @Column({ type: 'text', nullable: true })
  slack_webhook_url?: string

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date
}
