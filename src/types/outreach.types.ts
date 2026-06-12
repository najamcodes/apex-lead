// src/types/outreach.types.ts

export type OutreachStatus =
  | 'queued' // drafted, not sent
  | 'sent' // email sent successfully
  | 'delivered' // confirmed delivery (manual)
  | 'opened' // opened (manual log)
  | 'replied' // prospect replied
  | 'bounced' // email bounced
  | 'failed' // send attempt failed

export type SequenceStep = 1 | 2 | 3 // initial, day-3, day-14

export interface OutreachRecord {
  id: number
  lead_id: number
  step: SequenceStep // 1 = initial, 2 = follow-up 1, 3 = follow-up 2
  channel: 'email' | 'linkedin'
  subject: string | null
  body: string
  status: OutreachStatus
  scheduled_at: string // ISO timestamp — when to send
  sent_at: string | null
  opened_at: string | null
  replied_at: string | null
  error_message: string | null
  smtp_message_id: string | null
}

export interface OutreachInsert {
  lead_id: number
  step: SequenceStep
  channel: 'email' | 'linkedin'
  subject?: string
  body: string
  scheduled_at: string
}

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean // true = TLS (port 465), false = STARTTLS (port 587)
  username: string
  password: string
  from_name: string
  from_email: string
}

export interface SendResult {
  success: boolean
  message_id: string | null
  error: string | null
}

export interface SequenceSummary {
  lead_id: number
  business_name: string
  step1_status: OutreachStatus | null
  step2_status: OutreachStatus | null
  step3_status: OutreachStatus | null
  next_scheduled: string | null
}
