import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('settings')
export class SettingsEntity {
  @PrimaryColumn({ type: 'int', default: 1 })
  org_id!: number

  @PrimaryColumn({ type: 'text' })
  key!: string

  @Column({ type: 'text' })
  value!: string
}
