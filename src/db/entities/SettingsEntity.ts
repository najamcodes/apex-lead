import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('settings')
export class SettingsEntity {
  @PrimaryColumn({ type: 'text' })
  key!: string

  @Column({ type: 'text' })
  value!: string
}
