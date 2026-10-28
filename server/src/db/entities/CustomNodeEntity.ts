// backend/db/entities/CustomNodeEntity.ts
// Entity storing user-created custom nodes / plugins with custom execution logic and schemas.

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('custom_nodes')
@Index('idx_custom_node_org', ['org_id'])
export class CustomNodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'int', default: 1 })
  org_id!: number

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', nullable: true })
  node_key!: string | null // unique node type identifier, e.g. "custom_lead_scorer"

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'text', default: 'Custom' })
  category!: string

  @Column({ type: 'text', default: 'Code' })
  icon!: string

  @Column({ type: 'text', default: '#6366f1' })
  color!: string

  /** Custom async JavaScript execution code */
  @Column({ type: 'text' })
  code!: string

  /** JSON-encoded config schema for node input fields */
  @Column({ type: 'text', default: '{}' })
  config_schema!: string

  /** JSON-encoded inputs port list */
  @Column({ type: 'text', default: '[{"id":"main","label":"Input"}]' })
  inputs!: string

  /** JSON-encoded outputs port list */
  @Column({ type: 'text', default: '[{"id":"main","label":"Output"}]' })
  outputs!: string

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  @Column({ type: 'int', nullable: true })
  created_by!: number | null

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
