import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('email_templates')
export class EmailTemplateEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text' })
  subject!: string

  @Column({ type: 'text' })
  body!: string

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
