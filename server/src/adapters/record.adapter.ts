import type { RecordEntity } from '../db/entities/RecordEntity';
import type { RecordIdentityEntity, IdentifierType } from '../db/entities/RecordIdentityEntity';

export interface RecordIdentityDto {
  id: number;
  type: IdentifierType;
  value: string;
  createdAt: string;
}

export interface RecordResponseDto {
  id: number;
  orgId: number;
  collectionType: string;
  title: string;
  status: string;
  source: string;
  enrichmentScore: number;
  data: Record<string, unknown>;
  identities?: RecordIdentityDto[];
  createdAt: string;
  updatedAt: string;
}

export class RecordResponseAdapter {
  static toIdentityDto(entity: RecordIdentityEntity): RecordIdentityDto {
    return {
      id: entity.id,
      type: entity.identifier_type,
      value: entity.identifier_value,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
    };
  }

  static toDto(entity: RecordEntity | null | undefined): RecordResponseDto | null {
    if (!entity) return null;

    let parsedData: Record<string, unknown> = {};
    if (entity.data) {
      try {
        parsedData = typeof entity.data === 'string' ? JSON.parse(entity.data) : entity.data;
      } catch {
        parsedData = {};
      }
    }

    return {
      id: entity.id,
      orgId: entity.org_id,
      collectionType: entity.collection_type || 'leads',
      title: entity.title,
      status: entity.status || 'new',
      source: entity.source || 'manual',
      enrichmentScore: entity.enrichment_score ?? 0,
      data: parsedData,
      identities: entity.identities ? entity.identities.map(RecordResponseAdapter.toIdentityDto) : undefined,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  static toDtoList(entities: (RecordEntity | null | undefined)[]): RecordResponseDto[] {
    return entities
      .map((e) => RecordResponseAdapter.toDto(e))
      .filter((dto): dto is RecordResponseDto => dto !== null);
  }
}
