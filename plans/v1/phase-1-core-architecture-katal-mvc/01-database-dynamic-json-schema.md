# Phase 1 — Prompt 01: Polymorphic Dynamic JSON Record Architecture

> **Objective:** Replace the hardcoded `LeadEntity` table with a flexible, high-performance polymorphic record architecture that stores dynamic fields inside a JSON column while retaining O(1) indexed deduplication and tenant isolation.

---

## 1. Problem Context & Architectural Rationale

In the legacy architecture, `LeadEntity` possessed 35+ rigid columns: `business_name`, `phone`, `email`, `website_url`, `ai_site_score`, `tech_stack`, etc.
When scraping:
- **Contractors:** We need `licensed`, `insured`, `estimated_min_job_cost`, `cost_metric`.
- **Industrial Manufacturers (ThomasNet):** We need `annual_revenue_range`, `certifications: ['ISO 9001']`, `rfq_enabled`.
- **B2B SaaS (G2/Crunchbase):** We need `g2_grid_quadrant`, `funding_rounds`, `lead_investors`, `valuation`.
- **E-Commerce (Amazon/Shopify):** We need `asin`, `price_drop_pct`, `review_velocity`.

Adding hardcoded nullable columns for every vertical breaks clean database architecture.

### The Solution: Polymorphic Entity + Normalized Identifier Index
1. **`records` Table:** Houses common metadata (`id`, `org_id`, `collection_type`, `title`, `status`, `source`, `enrichment_score`) + a dynamic `data` column (`JSONB` in PostgreSQL / `TEXT` in SQLite).
2. **`record_identities` Table:** Normalized deduplication table storing unique identities per organization (`domain`, `email`, `phone`, `maps_place_id`, `linkedin_slug`). This guarantees **instant O(1) deduplication** without scanning large JSON blobs.
3. **`collection_schemas` Table:** Defines user and system collection attributes, types, validation rules, and default table views.

---

## 2. Database Schema DDL (PostgreSQL & SQLite)

### PostgreSQL 16 DDL

```sql
-- 1. Dynamic Polymorphic Records
CREATE TABLE IF NOT EXISTS records (
    id BIGSERIAL PRIMARY KEY,
    org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    collection_type VARCHAR(64) NOT NULL DEFAULT 'leads',
    title VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'new',
    source VARCHAR(64) NOT NULL DEFAULT 'manual',
    enrichment_score INT DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Fast Indexing for Tenant, Collection, Status, and Scores
CREATE INDEX idx_records_org_collection ON records(org_id, collection_type);
CREATE INDEX idx_records_org_status ON records(org_id, status);
CREATE INDEX idx_records_score ON records(org_id, enrichment_score DESC);
CREATE INDEX idx_records_deleted_at ON records(deleted_at) WHERE deleted_at IS NULL;

-- GIN Index on JSONB for high-speed attribute lookups
CREATE INDEX idx_records_data_gin ON records USING gin(data);

-- 2. Fast Deduplication & Identifier Registry
CREATE TABLE IF NOT EXISTS record_identities (
    id BIGSERIAL PRIMARY KEY,
    org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    record_id BIGINT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    identifier_type VARCHAR(32) NOT NULL, -- 'domain', 'email', 'phone', 'maps_place_id', 'linkedin'
    identifier_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_identifier UNIQUE (org_id, identifier_type, identifier_value)
);

CREATE INDEX idx_identities_lookup ON record_identities(org_id, identifier_type, identifier_value);
CREATE INDEX idx_identities_record_id ON record_identities(record_id);

-- 3. Dynamic Collection Definitions
CREATE TABLE IF NOT EXISTS collection_schemas (
    id SERIAL PRIMARY KEY,
    org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    views JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_collection_slug UNIQUE (org_id, slug)
);
```

### SQLite (Desktop / Edge) DDL

```sql
CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    collection_type TEXT NOT NULL DEFAULT 'leads',
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    source TEXT NOT NULL DEFAULT 'manual',
    enrichment_score INTEGER DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

CREATE INDEX IF NOT EXISTS idx_records_org_col ON records(org_id, collection_type);
CREATE INDEX IF NOT EXISTS idx_records_org_stat ON records(org_id, status);

CREATE TABLE IF NOT EXISTS record_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    record_id INTEGER NOT NULL,
    identifier_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, identifier_type, identifier_value),
    FOREIGN KEY(record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ident_lookup ON record_identities(org_id, identifier_type, identifier_value);

CREATE TABLE IF NOT EXISTS collection_schemas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    fields TEXT NOT NULL DEFAULT '[]',
    views TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, slug)
);
```

---

## 3. TypeORM Entity Implementations

### `server/src/models/RecordEntity.ts`

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm'
import { RecordIdentityEntity } from './RecordIdentityEntity'

@Entity('records')
@Index(['org_id', 'collection_type'])
@Index(['org_id', 'status'])
export class RecordEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ type: 'int' })
  @Index()
  org_id!: number

  @Column({ type: 'varchar', length: 64, default: 'leads' })
  collection_type!: string

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ type: 'varchar', length: 64, default: 'new' })
  status!: string

  @Column({ type: 'varchar', length: 64, default: 'manual' })
  source!: string

  @Column({ type: 'int', default: 0 })
  enrichment_score!: number

  @Column({
    type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'simple-json',
    default: {},
  })
  data!: Record<string, unknown>

  @OneToMany(() => RecordIdentityEntity, (identity) => identity.record, { cascade: true })
  identities?: RecordIdentityEntity[]

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date | null
}
```

### `server/src/models/RecordIdentityEntity.ts`

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { RecordEntity } from './RecordEntity'

export type IdentifierType = 'domain' | 'email' | 'phone' | 'maps_place_id' | 'linkedin' | 'external_id'

@Entity('record_identities')
@Unique(['org_id', 'identifier_type', 'identifier_value'])
@Index(['org_id', 'identifier_type', 'identifier_value'])
export class RecordIdentityEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ type: 'int' })
  org_id!: number

  @Column({ type: 'int' })
  record_id!: number

  @ManyToOne(() => RecordEntity, (record) => record.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  record?: RecordEntity

  @Column({ type: 'varchar', length: 32 })
  identifier_type!: IdentifierType

  @Column({ type: 'varchar', length: 255 })
  identifier_value!: string

  @CreateDateColumn()
  created_at!: Date
}
```

---

## 4. Upsert & O(1) Deduplication Engine

### `server/src/repositories/RecordRepository.ts`

```ts
import { AppDataSource } from '../db/data-source'
import { RecordEntity } from '../models/RecordEntity'
import { RecordIdentityEntity, IdentifierType } from '../models/RecordIdentityEntity'

export interface UpsertIdentityInput {
  type: IdentifierType
  value: string
}

export interface IngestRecordDto {
  orgId: number
  collectionType?: string
  title: string
  status?: string
  source?: string
  enrichmentScore?: number
  data: Record<string, unknown>
  identities: UpsertIdentityInput[]
}

export class RecordRepository {
  private recordRepo = AppDataSource.getRepository(RecordEntity)
  private identityRepo = AppDataSource.getRepository(RecordIdentityEntity)

  /**
   * Deduplicates by matching any supplied identity against record_identities.
   * If matched, merges data into existing record. If not, creates fresh record.
   */
  async upsertRecord(dto: IngestRecordDto): Promise<{ record: RecordEntity; isNew: boolean }> {
    return AppDataSource.transaction(async (manager) => {
      let existingRecordId: number | null = null

      // 1. Fast Index Check across all provided identities
      for (const ident of dto.identities) {
        if (!ident.value || !ident.value.trim()) continue
        const cleanVal = ident.value.trim().toLowerCase()

        const match = await manager.findOne(RecordIdentityEntity, {
          where: {
            org_id: dto.orgId,
            identifier_type: ident.type,
            identifier_value: cleanVal,
          },
        })

        if (match) {
          existingRecordId = match.record_id
          break
        }
      }

      // 2. Update existing record with merged JSON data
      if (existingRecordId) {
        const existing = await manager.findOneByOrFail(RecordEntity, { id: existingRecordId })
        existing.data = {
          ...existing.data,
          ...dto.data,
          last_updated_at: new Date().toISOString(),
        }
        if (dto.enrichmentScore !== undefined) {
          existing.enrichment_score = Math.max(existing.enrichment_score, dto.enrichmentScore)
        }
        if (dto.title && !existing.title) existing.title = dto.title
        await manager.save(RecordEntity, existing)

        // Attach any newly discovered identities
        await this.syncIdentities(manager, dto.orgId, existing.id, dto.identities)
        return { record: existing, isNew: false }
      }

      // 3. Insert brand new record
      const newRecord = manager.create(RecordEntity, {
        org_id: dto.orgId,
        collection_type: dto.collectionType || 'leads',
        title: dto.title,
        status: dto.status || 'new',
        source: dto.source || 'manual',
        enrichment_score: dto.enrichmentScore || 0,
        data: dto.data,
      })

      const saved = await manager.save(RecordEntity, newRecord)
      await this.syncIdentities(manager, dto.orgId, saved.id, dto.identities)
      return { record: saved, isNew: true }
    })
  }

  private async syncIdentities(manager: any, orgId: number, recordId: number, identities: UpsertIdentityInput[]) {
    for (const ident of identities) {
      if (!ident.value || !ident.value.trim()) continue
      const cleanVal = ident.value.trim().toLowerCase()
      try {
        const identityEntity = manager.create(RecordIdentityEntity, {
          org_id: orgId,
          record_id: recordId,
          identifier_type: ident.type,
          identifier_value: cleanVal,
        })
        await manager.save(RecordIdentityEntity, identityEntity)
      } catch {
        // Unique constraint catches duplicate identity assignment gracefully
      }
    }
  }
}
```

---

## 5. Automated Data Migration from Legacy `LeadEntity`

A migration script migrates existing rows from `leads` to `records` without downtime:

```ts
// scripts/migrate-leads-to-records.ts
import { AppDataSource } from '../backend/db/data-source'
import { RecordEntity } from '../server/src/models/RecordEntity'
import { RecordIdentityEntity } from '../server/src/models/RecordIdentityEntity'

export async function migrateLeadsToRecords() {
  await AppDataSource.initialize()
  const queryRunner = AppDataSource.createQueryRunner()

  const leads = await queryRunner.query('SELECT * FROM leads')
  console.log(`Migrating ${leads.length} legacy leads to dynamic records...`)

  for (const lead of leads) {
    const identities = []
    if (lead.email) identities.push({ type: 'email', value: lead.email.toLowerCase() })
    if (lead.website_url) {
      try {
        const domain = new URL(lead.website_url).hostname.replace(/^www\./, '')
        identities.push({ type: 'domain', value: domain })
      } catch {}
    }
    if (lead.phone) identities.push({ type: 'phone', value: lead.phone.replace(/[^0-9+]/g, '') })
    if (lead.google_maps_url) identities.push({ type: 'maps_place_id', value: lead.google_maps_url })

    const record = AppDataSource.getRepository(RecordEntity).create({
      org_id: lead.org_id || 1,
      collection_type: 'leads',
      title: lead.business_name || 'Untitled Lead',
      status: lead.status || 'new',
      source: lead.source || 'google_maps',
      enrichment_score: lead.ai_site_score || 0,
      data: {
        business_name: lead.business_name,
        category: lead.category,
        city: lead.city,
        country: lead.country,
        phone: lead.phone,
        email: lead.email,
        website_url: lead.website_url,
        google_maps_url: lead.google_maps_url,
        ai_site_score: lead.ai_site_score,
        ai_site_summary: lead.ai_site_summary,
        ai_personalized_hook: lead.ai_personalized_hook,
        tech_stack: typeof lead.tech_stack === 'string' ? JSON.parse(lead.tech_stack || '[]') : lead.tech_stack,
        review_rating: lead.review_rating,
        review_count: lead.review_count,
        pagespeed_mobile: lead.pagespeed_mobile,
        ssl_valid: lead.ssl_valid,
      },
      created_at: lead.created_at,
      updated_at: lead.updated_at,
    })

    const saved = await AppDataSource.getRepository(RecordEntity).save(record)

    for (const ident of identities) {
      try {
        await AppDataSource.getRepository(RecordIdentityEntity).save({
          org_id: saved.org_id,
          record_id: saved.id,
          identifier_type: ident.type as any,
          identifier_value: ident.value,
        })
      } catch {}
    }
  }

  console.log('Migration completed successfully!')
  await AppDataSource.destroy()
}
```

---

## 6. Verification & Acceptance Criteria
- [ ] `records` table stores arbitrary vertical JSON in `data`.
- [ ] `record_identities` prevents duplicate records across duplicate domain, email, and phone imports.
- [ ] Ingesting 10,000 records takes under 2.5 seconds using batch identity lookups.
- [ ] Existing `LeadEntity` rows migrate cleanly with 100% data fidelity.
