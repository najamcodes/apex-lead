// src/db/queries/activity.queries.ts
import { getDb } from '../index'
import type { ActivityRecord, ActivityEvent } from '../../types/activity.types'

export function logActivity(
  leadId: number,
  event: ActivityEvent,
  detail?: string
): void {
  getDb().prepare(
    'INSERT INTO activity (lead_id, event, detail) VALUES (?, ?, ?)'
  ).run(leadId, event, detail ?? null)
}

export function getActivityByLead(leadId: number, limit = 20): ActivityRecord[] {
  return getDb().prepare(`
    SELECT * FROM activity WHERE lead_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(leadId, limit) as ActivityRecord[]
}

export function getRecentActivity(limit = 30): (ActivityRecord & { business_name: string })[] {
  return getDb().prepare(`
    SELECT a.*, l.business_name
    FROM activity a
    JOIN leads l ON l.id = a.lead_id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit) as (ActivityRecord & { business_name: string })[]
}
