import type { LeadEntity } from '../db/entities/LeadEntity';

export interface LeadResponseDto {
  id: number;
  orgId: number;
  businessName: string;
  category: string;
  city: string;
  country: string;
  phone: string | null;
  email: string | null;
  emailVerified: boolean | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  websiteStatus: string;
  pagespeedMobile: number | null;
  pagespeedDesktop: number | null;
  sslValid: boolean | null;
  techStack: string[];
  aiScore: number | null;
  aiSummary: string | null;
  status: string;
  source: string;
  reviewerNotes: string | null;
  contactName: string | null;
  aiHook: string | null;
  priorityScore: number | null;
  scrapedAt: string;
  updatedAt: string;
}

export class LeadResponseAdapter {
  /**
   * Transforms a single LeadEntity to LeadResponseDto
   */
  static toDto(entity: LeadEntity | null | undefined): LeadResponseDto | null {
    if (!entity) return null;

    let parsedTechStack: string[] = [];
    if (entity.tech_stack) {
      try {
        parsedTechStack = JSON.parse(entity.tech_stack);
      } catch {
        parsedTechStack = entity.tech_stack.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }

    return {
      id: entity.id,
      orgId: entity.org_id,
      businessName: entity.business_name,
      category: entity.category || '',
      city: entity.city || '',
      country: entity.country || '',
      phone: entity.phone || null,
      email: entity.email || null,
      emailVerified: entity.email_verified ?? null,
      websiteUrl: entity.website_url || null,
      googleMapsUrl: entity.google_maps_url || null,
      websiteStatus: entity.website_status || 'unchecked',
      pagespeedMobile: entity.pagespeed_mobile ?? null,
      pagespeedDesktop: entity.pagespeed_desktop ?? null,
      sslValid: entity.ssl_valid ?? null,
      techStack: parsedTechStack,
      aiScore: entity.ai_site_score ?? null,
      aiSummary: entity.ai_site_summary || null,
      status: entity.status || 'scraped',
      source: entity.source || 'manual',
      reviewerNotes: entity.reviewer_notes || null,
      contactName: entity.contact_name || null,
      aiHook: entity.ai_personalized_hook || null,
      priorityScore: entity.priority_score ?? null,
      scrapedAt: entity.scraped_at ? new Date(entity.scraped_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Transforms an array of LeadEntity instances to LeadResponseDto[]
   */
  static toDtoList(entities: (LeadEntity | null | undefined)[]): LeadResponseDto[] {
    return entities
      .map((e) => LeadResponseAdapter.toDto(e))
      .filter((dto): dto is LeadResponseDto => dto !== null);
  }
}
