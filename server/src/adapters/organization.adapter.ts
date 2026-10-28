import type { OrganizationEntity } from '../db/entities/OrganizationEntity';
import type { OrganizationUsageEntity } from '../db/entities/OrganizationUsageEntity';

export interface OrganizationUsageDto {
  billingPeriod: string;
  leadsExported: number;
  cloudScrapesExecuted: number;
  waterfallChecksUsed: number;
  aiTokensUsed: number;
}

export interface OrganizationResponseDto {
  id: number;
  name: string;
  tier: string;
  billingEmail: string | null;
  logoUrl: string | null;
  maxUsers: number;
  settings: Record<string, unknown>;
  usage?: OrganizationUsageDto;
  createdAt: string;
  updatedAt: string;
}

export class OrganizationResponseAdapter {
  static toUsageDto(usage: OrganizationUsageEntity | null | undefined): OrganizationUsageDto | undefined {
    if (!usage) return undefined;
    return {
      billingPeriod: usage.billing_period,
      leadsExported: usage.leads_exported ?? 0,
      cloudScrapesExecuted: usage.cloud_scrapes_executed ?? 0,
      waterfallChecksUsed: usage.waterfall_checks_used ?? 0,
      aiTokensUsed: usage.ai_tokens_used ?? 0,
    };
  }

  static toDto(
    entity: OrganizationEntity | null | undefined,
    usage?: OrganizationUsageEntity | null
  ): OrganizationResponseDto | null {
    if (!entity) return null;

    let parsedSettings: Record<string, unknown> = {};
    if (entity.settings) {
      try {
        parsedSettings = typeof entity.settings === 'string'
          ? JSON.parse(entity.settings)
          : entity.settings;
      } catch {
        parsedSettings = {};
      }
    }

    return {
      id: entity.id,
      name: entity.name,
      tier: entity.tier || 'free',
      billingEmail: entity.billing_email || null,
      logoUrl: entity.logo_url || null,
      maxUsers: entity.max_users ?? 5,
      settings: parsedSettings,
      usage: OrganizationResponseAdapter.toUsageDto(usage),
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  static toDtoList(entities: (OrganizationEntity | null | undefined)[]): OrganizationResponseDto[] {
    return entities
      .map((e) => OrganizationResponseAdapter.toDto(e))
      .filter((dto): dto is OrganizationResponseDto => dto !== null);
  }
}
