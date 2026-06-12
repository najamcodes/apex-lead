// src/db/queries/outreach.queries.ts
import { getDb } from '../index'
import type {
  OutreachRecord,
  OutreachInsert,
  OutreachStatus,
  SequenceSummary
} from '../../types/outreach.types'

export function insertOutreach(data: OutreachInsert): OutreachRecord {
  const db = getDb()
  const result = db
    .prepare(
      `
    INSERT INTO outreach (lead_id, step, channel, subject, body, scheduled_at)
    VALUES (@lead_id, @step, @channel, @subject, @body, @scheduled_at)
  `
    )
    .run(data)
  return getOutreachById(result.lastInsertRowid as number)!
}

export function getOutreachById(id: number): OutreachRecord | null {
  return getDb().prepare('SELECT * FROM outreach WHERE id = ?').get(id) as OutreachRecord | null
}

export function getAllOutreach(
  status?: OutreachStatus,
  pagination?: import('../../types').PaginationParams
): import('../../types').PaginatedResponse<OutreachRecord> {
  const db = getDb()
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  let sql = 'SELECT * FROM outreach'
  let countSql = 'SELECT COUNT(*) as count FROM outreach'
  const params: any = { limit: pageSize, offset }

  if (status) {
    sql += ' WHERE status = @status ORDER BY scheduled_at ASC'
    countSql += ' WHERE status = @status'
    params.status = status
  } else {
    sql += ' ORDER BY scheduled_at DESC'
  }

  sql += ' LIMIT @limit OFFSET @offset'

  const totalRes = db.prepare(countSql).get(status ? { status } : {}) as { count: number }
  const data = db.prepare(sql).all(params) as OutreachRecord[]

  return { data, total: totalRes.count }
}

export function getOutreachByLead(leadId: number): OutreachRecord[] {
  return getDb()
    .prepare('SELECT * FROM outreach WHERE lead_id = ? ORDER BY step ASC')
    .all(leadId) as OutreachRecord[]
}

export function updateOutreachStatus(
  id: number,
  status: OutreachStatus,
  extra?: {
    sent_at?: string
    replied_at?: string
    error_message?: string
    smtp_message_id?: string
  }
): void {
  const fields = ['status = @status']
  const params: Record<string, unknown> = { id, status }
  if (extra?.sent_at) {
    fields.push('sent_at = @sent_at')
    params.sent_at = extra.sent_at
  }
  if (extra?.replied_at) {
    fields.push('replied_at = @replied_at')
    params.replied_at = extra.replied_at
  }
  if (extra?.error_message) {
    fields.push('error_message = @error_message')
    params.error_message = extra.error_message
  }
  if (extra?.smtp_message_id) {
    fields.push('smtp_message_id = @smtp_message_id')
    params.smtp_message_id = extra.smtp_message_id
  }
  getDb()
    .prepare(`UPDATE outreach SET ${fields.join(', ')} WHERE id = @id`)
    .run(params)
}

export function getDueOutreach(): OutreachRecord[] {
  return getDb()
    .prepare(
      `
    SELECT * FROM outreach
    WHERE status = 'queued'
    AND scheduled_at <= datetime('now')
    ORDER BY scheduled_at ASC
  `
    )
    .all() as OutreachRecord[]
}

export function getSequenceSummaries(
  pagination?: import('../../types').PaginationParams
): import('../../types').PaginatedResponse<SequenceSummary> {
  const db = getDb()
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const totalRes = db
    .prepare('SELECT COUNT(DISTINCT lead_id) as count FROM outreach')
    .get() as { count: number }

  const data = db
    .prepare(
      `
    SELECT
      l.id AS lead_id,
      l.business_name,
      MAX(CASE WHEN o.step = 1 THEN o.status END) AS step1_status,
      MAX(CASE WHEN o.step = 2 THEN o.status END) AS step2_status,
      MAX(CASE WHEN o.step = 3 THEN o.status END) AS step3_status,
      MIN(CASE WHEN o.status = 'queued' THEN o.scheduled_at END) AS next_scheduled
    FROM leads l
    JOIN outreach o ON o.lead_id = l.id
    GROUP BY l.id
    ORDER BY next_scheduled ASC NULLS LAST
    LIMIT @limit OFFSET @offset
  `
    )
    .all({ limit: pageSize, offset }) as SequenceSummary[]

  return { data, total: totalRes.count }
}
