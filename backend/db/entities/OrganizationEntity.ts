import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text' })
  name!: string

  @CreateDateColumn()
  created_at!: Date
}
