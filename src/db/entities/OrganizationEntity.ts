import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', default: () => "datetime('now')" })
  created_at!: string
}
