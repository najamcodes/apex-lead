// src/types/activity.types.ts

export type ActivityEvent =
  | 'lead_scraped'
  | 'lead_analyzed'
  | 'lead_approved'
  | 'lead_skipped'
  | 'email_sent'
  | 'email_replied'
  | 'email_bounced'
  | 'sequence_started'
  | 'email_found'
  | 'note_added'

export interface ActivityRecord {
  id: number
  lead_id: number
  event: ActivityEvent
  detail: string | null // e.g. "PageSpeed: 34/100", "Step 2 sent"
  created_at: string
}

export interface NoteRecord {
  id: number
  lead_id: number
  body: string
  created_at: string
  updated_at: string
}
