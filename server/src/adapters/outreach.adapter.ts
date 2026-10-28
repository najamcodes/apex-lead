import type { OutreachEntity } from '../db/entities/OutreachEntity';
import type { CadenceEntity } from '../db/entities/CadenceEntity';
import type { EmailAccountEntity } from '../db/entities/EmailAccountEntity';

export interface OutreachResponseDto {
  id: number;
  orgId: number;
  leadId: number;
  step: number;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  scheduledAt: string;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface CadenceResponseDto {
  id: string;
  orgId: number;
  name: string;
  status: string;
  dailyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailAccountResponseDto {
  id: number;
  orgId: number;
  emailAddress: string;
  senderName: string;
  dailyLimit: number;
  sentToday: number;
  status: string;
  lastError: string | null;
  createdAt: string;
}

export class OutreachResponseAdapter {
  static toOutreachDto(entity: OutreachEntity | null | undefined): OutreachResponseDto | null {
    if (!entity) return null;
    return {
      id: entity.id,
      orgId: entity.org_id,
      leadId: entity.lead_id,
      step: entity.step ?? 1,
      channel: entity.channel || 'email',
      status: entity.status,
      subject: entity.subject || null,
      body: entity.body || null,
      scheduledAt: entity.scheduled_at,
      sentAt: entity.sent_at || null,
      openedAt: entity.opened_at || null,
      repliedAt: entity.replied_at || null,
      errorMessage: entity.error_message || null,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
    };
  }

  static toCadenceDto(entity: CadenceEntity | null | undefined): CadenceResponseDto | null {
    if (!entity) return null;
    return {
      id: entity.id,
      orgId: entity.org_id,
      name: entity.name,
      status: entity.status || 'draft',
      dailyLimit: entity.daily_limit ?? 100,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  static toEmailAccountDto(entity: EmailAccountEntity | null | undefined): EmailAccountResponseDto | null {
    if (!entity) return null;
    return {
      id: entity.id,
      orgId: entity.org_id,
      emailAddress: entity.email_address,
      senderName: entity.sender_name || '',
      dailyLimit: entity.daily_limit ?? 50,
      sentToday: entity.sent_today ?? 0,
      status: entity.status || 'active',
      lastError: entity.last_error || null,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
