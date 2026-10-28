import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('email_accounts')
export class EmailAccountEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text', unique: true })
  email_address!: string

  @Column({ type: 'text' })
  app_password!: string

  @Column({ type: 'text' })
  sender_name!: string

  @Column({ type: 'int', default: 50 })
  daily_limit!: number

  @Column({ type: 'int', default: 0 })
  sent_today!: number

  @Column({ type: 'text', default: 'active' })
  status!: string

  @Column({ type: 'text', nullable: true })
  last_error!: string | null

  @CreateDateColumn()
  created_at!: string

  @UpdateDateColumn()
  updated_at!: string
}
