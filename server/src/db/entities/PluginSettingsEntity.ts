// src/db/entities/PluginSettingsEntity.ts
// Stores per-plugin enable/disable state and config per org.

import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('plugin_settings')
export class PluginSettingsEntity {
  /** Plugin ID, e.g. 'connector-webhook' */
  @PrimaryColumn({ type: 'varchar', length: 100 })
  plugin_id!: string

  /** Organization ID — allows per-org plugin config in multi-tenant setups. */
  @PrimaryColumn({ type: 'integer' })
  org_id!: number

  @Column({ type: 'integer', default: 0 })
  enabled!: number  // SQLite stores booleans as 0/1

  /** JSON-encoded plugin config object, validated against plugin.configSchema on write. */
  @Column({ type: 'text', nullable: true })
  config!: string | null

  @Column({ type: 'varchar', length: 50 })
  updated_at!: string
}
