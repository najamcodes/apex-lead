import { RecordRepository, IngestRecordDto, ListRecordsOptions } from '../db/repositories/RecordRepository';
import { RecordEntity } from '../db/entities/RecordEntity';
import { UpsertRecordDto, ListRecordsQueryDto } from '../common';

export class RecordService {
  constructor(private recordRepo: RecordRepository) {}

  /**
   * Upserts a dynamic polymorphic record, performing deduplication and data merging.
   */
  async upsertRecord(
    orgId: number,
    dto: UpsertRecordDto
  ): Promise<{ record: RecordEntity; isNew: boolean }> {
    if (!orgId || orgId <= 0) {
      throw new Error('Tenant orgId must be a positive integer.');
    }

    const ingestDto: IngestRecordDto = {
      orgId,
      collectionType: dto.collectionType,
      title: dto.title,
      status: dto.status,
      source: dto.source,
      enrichmentScore: dto.enrichmentScore,
      data: dto.data,
      identities: dto.identities || [],
    };

    return this.recordRepo.upsertRecord(ingestDto);
  }

  /**
   * Retrieves paginated records for the tenant.
   */
  async listRecords(
    orgId: number,
    query: Partial<ListRecordsQueryDto> = { page: 1, limit: 20 }
  ): Promise<{ records: RecordEntity[]; total: number; page: number; totalPages: number }> {
    if (!orgId || orgId <= 0) {
      throw new Error('Tenant orgId must be a positive integer.');
    }

    const options: ListRecordsOptions = {
      collectionType: query.collectionType,
      status: query.status,
      source: query.source,
      minScore: query.minScore,
      search: query.search,
      page: query.page,
      limit: query.limit,
      withIdentities: query.withIdentities,
    };

    const { records, total } = await this.recordRepo.listRecords(orgId, options);
    const limit = query.limit || 20;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      records,
      total,
      page: query.page || 1,
      totalPages,
    };
  }

  /**
   * Retrieves a single record by ID within tenant scope.
   */
  async getRecordById(orgId: number, id: number): Promise<RecordEntity> {
    if (!orgId || orgId <= 0) {
      throw new Error('Tenant orgId must be a positive integer.');
    }

    const record = await this.recordRepo.findById(orgId, id);
    if (!record) {
      throw new Error(`Record with ID ${id} not found in current organization.`);
    }

    const identities = await this.recordRepo.findIdentities(orgId, id);
    record.identities = identities;
    return record;
  }

  /**
   * Deletes a record within tenant scope.
   */
  async deleteRecord(orgId: number, id: number): Promise<boolean> {
    if (!orgId || orgId <= 0) {
      throw new Error('Tenant orgId must be a positive integer.');
    }

    const deleted = await this.recordRepo.deleteById(orgId, id);
    if (!deleted) {
      throw new Error(`Record with ID ${id} not found or already deleted.`);
    }
    return true;
  }
}
