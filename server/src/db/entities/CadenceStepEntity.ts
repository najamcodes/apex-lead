import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('cadence_steps')
@Index('idx_cadence_steps_cadence', ['cadence_id', 'step_number'])
export class CadenceStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 36 })
  cadence_id!: string

  @Column({ type: 'integer' })
  step_number!: number

  @Column({ type: 'integer', default: 1 })
  delay_days!: number

  @Column({ type: 'text' })
  subject_template!: string

  @Column({ type: 'text' })
  body_template!: string

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date
}
