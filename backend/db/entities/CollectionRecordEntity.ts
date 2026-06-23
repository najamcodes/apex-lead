// backend/db/entities/CollectionRecordEntity.ts
// Generic JSONB record store. One table for all non-lead collections.

import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('collection_records')
export class CollectionRecordEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string

  @Column({ type: 'varchar', length: 100 })
  collection!: string

  @Column({ type: 'integer' })
  org_id!: number

  /** JSON-encoded record data. */
  @Column({ type: 'text' })
  data!: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  source!: string | null

  @Column({ type: 'varchar', length: 50 })
  created_at!: string

  @Column({ type: 'varchar', length: 50 })
  updated_at!: string
}
