import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text', unique: true })
  email!: string

  @Column({ type: 'text' })
  password_hash!: string

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text', default: 'user' })
  role!: string

  @Column({ type: 'text', default: '[]' })
  permissions!: string

  @Column({ type: 'text', default: () => "datetime('now')" })
  created_at!: string
}
