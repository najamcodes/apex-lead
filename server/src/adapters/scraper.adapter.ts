import type { ScrapeJobEntity } from '../db/entities/ScrapeJobEntity';

export interface ScrapeJobResponseDto {
  id: string;
  orgId: number;
  createdByUserId: number | null;
  query: string;
  city: string;
  country: string;
  maxResults: number;
  status: string;
  progress: number;
  found: number;
  errors: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export class ScraperResponseAdapter {
  static toDto(entity: ScrapeJobEntity | null | undefined): ScrapeJobResponseDto | null {
    if (!entity) return null;

    return {
      id: entity.id,
      orgId: entity.org_id,
      createdByUserId: entity.created_by_user_id,
      query: entity.query,
      city: entity.city,
      country: entity.country,
      maxResults: entity.max_results ?? 100,
      status: entity.status,
      progress: entity.progress ?? 0,
      found: entity.found ?? 0,
      errors: entity.errors ?? 0,
      errorMessage: entity.error_message || null,
      startedAt: entity.started_at,
      completedAt: entity.completed_at,
    };
  }

  static toDtoList(entities: (ScrapeJobEntity | null | undefined)[]): ScrapeJobResponseDto[] {
    return entities
      .map((e) => ScraperResponseAdapter.toDto(e))
      .filter((dto): dto is ScrapeJobResponseDto => dto !== null);
  }
}
