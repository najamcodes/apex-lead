import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('mailbox_dns_audits')
@Index('idx_dns_audits_mailbox', ['mailbox_id'])
export class MailboxDnsAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 36 })
  mailbox_id!: string

  @Column({ type: 'boolean', default: false })
  spf_valid!: boolean

  @Column({ type: 'text', nullable: true })
  spf_record?: string

  @Column({ type: 'boolean', default: false })
  dkim_valid!: boolean

  @Column({ type: 'varchar', length: 100, nullable: true })
  dkim_selector?: string

  @Column({ type: 'boolean', default: false })
  dmarc_valid!: boolean

  @Column({ type: 'text', nullable: true })
  dmarc_record?: string

  @CreateDateColumn({ type: 'datetime' })
  last_checked_at!: Date
}
