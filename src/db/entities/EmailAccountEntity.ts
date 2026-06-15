import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('email_accounts')
export class EmailAccountEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true })
  email_address!: string

  @Column()
  app_password!: string

  @Column()
  sender_name!: string

  @Column({ default: 50 })
  daily_limit!: number

  @Column({ default: 0 })
  sent_today!: number

  @Column({ default: 'active' })
  status!: string

  @Column({ type: 'text', nullable: true })
  last_error!: string | null

  @CreateDateColumn()
  created_at!: string

  @UpdateDateColumn()
  updated_at!: string
}
