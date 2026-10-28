import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('voice_campaigns')
@Index('idx_voice_campaigns_org', ['org_id'])
export class VoiceCampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'integer' })
  org_id!: number

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @Column({ type: 'varchar', length: 50, default: 'vapi' })
  voice_provider!: string // 'vapi' | 'retell' | 'elevenlabs'

  @Column({ type: 'varchar', length: 255, nullable: true })
  assistant_id?: string

  @Column({ type: 'text' })
  system_prompt_template!: string

  @Column({ type: 'text' })
  first_sentence_template!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone_number_id?: string

  @Column({ type: 'integer', default: 300 })
  max_duration_seconds!: number

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date
}
