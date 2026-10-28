import type { EntityManager } from 'typeorm';
import { BaseTenantRepository } from './BaseTenantRepository';
import { RecordEntity } from '../entities/RecordEntity';
import { RecordIdentityEntity, type IdentifierType } from '../entities/RecordIdentityEntity';

export interface UpsertIdentityInput {
  type: IdentifierType;
  value: string;
}

export interface IngestRecordDto {
  orgId: number;
  collectionType?: string;
  title: string;
  status?: string;
  source?: string;
  enrichmentScore?: number;
  data: Record<string, unknown>;
  identities: UpsertIdentityInput[];
}

export interface ListRecordsOptions {
  collectionType?: string;
  status?: string;
  source?: string;
  minScore?: number;
  search?: string;
  page?: number;
  limit?: number;
  withIdentities?: boolean;
}

/**
 * Strips dangerous prototype pollution properties recursively.
 * Drops __proto__, constructor, and prototype keys.
 */
export function sanitizeJsonPayload<T>(input: T, depth = 0): T {
  if (depth > 20) {
    throw new Error('Payload nesting depth exceeded maximum threshold (20).');
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeJsonPayload(item, depth + 1)) as unknown as T;
  }

  const clean = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(input)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = sanitizeJsonPayload(value, depth + 1);
  }
  return clean as T;
}

export class RecordRepository extends BaseTenantRepository<RecordEntity> {
  constructor() {
    super(RecordEntity);
  }

  private get identityRepo() {
    return this.dataSource.getRepository(RecordIdentityEntity);
  }

  /**
   * Deduplicates by matching any supplied identity against record_identities for the tenant.
   * If matched, merges data into existing record. If not, creates fresh record.
   * Prevents prototype pollution and cross-tenant leakage.
   */
  async upsertRecord(dto: IngestRecordDto): Promise<{ record: RecordEntity; isNew: boolean }> {
    if (!dto.orgId || typeof dto.orgId !== 'number' || dto.orgId <= 0) {
      throw new Error('Valid tenant orgId is required.');
    }
    if (!dto.title || typeof dto.title !== 'string') {
      throw new Error('Record title is required.');
    }

    const sanitizedData = sanitizeJsonPayload(dto.data || {});

    // Normalize and filter valid identities
    const normalizedIdentities = (dto.identities || [])
      .filter((ident) => ident && typeof ident.value === 'string' && ident.value.trim().length > 0)
      .map((ident) => ({
        type: ident.type,
        value: ident.value.trim().toLowerCase(),
      }));

    return this.dataSource.transaction(async (manager) => {
      let matchedRecordId: number | null = null;

      // 1. Batch Identity Check across all provided identities for this org
      if (normalizedIdentities.length > 0) {
        const identityRepo = manager.getRepository(RecordIdentityEntity);

        const queryBuilder = identityRepo
          .createQueryBuilder('ident')
          .select(['ident.record_id'])
          .where('ident.org_id = :orgId', { orgId: dto.orgId });

        const conditions: string[] = [];
        const params: Record<string, unknown> = { orgId: dto.orgId };

        normalizedIdentities.forEach((ident, idx) => {
          conditions.push(`(ident.identifier_type = :t${idx} AND ident.identifier_value = :v${idx})`);
          params[`t${idx}`] = ident.type;
          params[`v${idx}`] = ident.value;
        });

        queryBuilder.andWhere(`(${conditions.join(' OR ')})`, params);
        const match = await queryBuilder.getOne();

        if (match) {
          matchedRecordId = match.record_id;
        }
      }

      // 2. If matched, update existing record with merged data
      if (matchedRecordId) {
        const recordRepo = manager.getRepository(RecordEntity);
        const existing = await recordRepo.findOne({
          where: { id: matchedRecordId, org_id: dto.orgId },
        });

        if (existing) {
          const currentData = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data || {};
          existing.data = {
            ...currentData,
            ...sanitizedData,
            last_merged_at: new Date().toISOString(),
          };

          if (dto.enrichmentScore !== undefined) {
            existing.enrichment_score = Math.max(existing.enrichment_score || 0, dto.enrichmentScore);
          }
          if (dto.status && existing.status === 'new') {
            existing.status = dto.status;
          }
          if (dto.title && !existing.title) {
            existing.title = dto.title;
          }

          existing.updated_at = new Date();
          const updated = await recordRepo.save(existing);

          // Synchronize newly discovered identities
          await this.syncIdentities(manager, dto.orgId, updated.id, normalizedIdentities);
          return { record: updated, isNew: false };
        }
      }

      // 3. Insert brand new record
      const recordRepo = manager.getRepository(RecordEntity);
      const newRecord = recordRepo.create({
        org_id: dto.orgId,
        collection_type: dto.collectionType || 'leads',
        title: dto.title.trim(),
        status: dto.status || 'new',
        source: dto.source || 'manual',
        enrichment_score: dto.enrichmentScore || 0,
        data: sanitizedData,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const saved = await recordRepo.save(newRecord);
      await this.syncIdentities(manager, dto.orgId, saved.id, normalizedIdentities);
      return { record: saved, isNew: true };
    });
  }

  /**
   * Safely synchronizes identities, ignoring duplicates per tenant unique index.
   */
  private async syncIdentities(
    manager: EntityManager,
    orgId: number,
    recordId: number,
    identities: Array<{ type: IdentifierType; value: string }>
  ): Promise<void> {
    const identityRepo = manager.getRepository(RecordIdentityEntity);
    for (const ident of identities) {
      const exists = await identityRepo.findOne({
        where: {
          org_id: orgId,
          identifier_type: ident.type,
          identifier_value: ident.value,
        },
      });

      if (!exists) {
        try {
          const entity = identityRepo.create({
            org_id: orgId,
            record_id: recordId,
            identifier_type: ident.type,
            identifier_value: ident.value,
            created_at: new Date(),
          });
          await identityRepo.save(entity);
        } catch {
          // Unique index constraint gracefully handles concurrent race conditions
        }
      }
    }
  }

  async listRecords(
    orgId: number,
    options: ListRecordsOptions = {}
  ): Promise<{ records: RecordEntity[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.tenantQuery(orgId, 'r');

    if (options.collectionType) {
      qb.andWhere('r.collection_type = :col', { col: options.collectionType });
    }
    if (options.status) {
      qb.andWhere('r.status = :status', { status: options.status });
    }
    if (options.source) {
      qb.andWhere('r.source = :src', { src: options.source });
    }
    if (options.minScore !== undefined) {
      qb.andWhere('r.enrichment_score >= :minScore', { minScore: options.minScore });
    }
    if (options.search) {
      qb.andWhere('LOWER(r.title) LIKE :search', { search: `%${options.search.toLowerCase()}%` });
    }

    qb.andWhere('r.deleted_at IS NULL');
    qb.orderBy('r.id', 'DESC').skip(skip).take(limit);

    if (options.withIdentities) {
      qb.leftJoinAndSelect('r.identities', 'identities');
    }

    const [records, total] = await qb.getManyAndCount();
    return { records, total };
  }

  async findIdentities(orgId: number, recordId: number): Promise<RecordIdentityEntity[]> {
    return this.identityRepo.find({
      where: { org_id: orgId, record_id: recordId },
    });
  }
}
