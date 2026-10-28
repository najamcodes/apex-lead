// backend/db/entities/AIConnectionEntity.ts
// Entity storing named AI Connection setups (Ollama, LM Studio, OpenAI, Anthropic, Custom Gateways).

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export type AIProviderType =
  | 'openrouter'
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'anthropic'
  | 'lmstudio'
  | 'ollama'
  | 'custom_openai'
  | 'custom_claude'

@Entity('ai_connections')
@Index('idx_ai_conn_org', ['org_id'])
export class AIConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', default: 'openrouter' })
  provider!: AIProviderType

  @Column({ type: 'text', nullable: true })
  base_url!: string | null

  @Column({ type: 'text', nullable: true })
  api_key!: string | null

  @Column({ type: 'text', nullable: true })
  default_model!: string | null

  @Column({ type: 'boolean', default: false })
  is_default!: boolean

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
