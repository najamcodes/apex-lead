import { getDataSource } from '../index'
import { OutreachEntity } from '../entities/OutreachEntity'
import type {
  OutreachRecord,
  OutreachInsert,
  OutreachStatus,
  SequenceSummary
} from '../../types/outreach.types'

export async function insertOutreach(data: OutreachInsert): Promise<OutreachRecord> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const entity = repo.create({
    lead_id: data.lead_id,
    step: data.step,
    channel: data.channel,
    subject: data.subject,
    body: data.body,
    scheduled_at: data.scheduled_at
  })
  const saved = await repo.save(entity)
  return saved as OutreachRecord
}

export async function getOutreachById(id: number): Promise<OutreachRecord | null> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const res = await repo.findOne({ where: { id } })
  return (res as OutreachRecord) || null
}

export async function getAllOutreach(
  status?: OutreachStatus,
  pagination?: import('../../types').PaginationParams
): Promise<import('../../types').PaginatedResponse<OutreachRecord>> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const [data, total] = await repo.findAndCount({
    where: status ? { status } : {},
    order: status ? { scheduled_at: 'ASC' } : { scheduled_at: 'DESC' },
    skip: offset,
    take: pageSize
  })

  return { data: data as OutreachRecord[], total }
}

export async function getOutreachByLead(leadId: number): Promise<OutreachRecord[]> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const res = await repo.find({
    where: { lead_id: leadId },
    order: { step: 'ASC' }
  })
  return res as OutreachRecord[]
}

export async function updateOutreachStatus(
  id: number,
  status: OutreachStatus,
  extra?: {
    sent_at?: string
    replied_at?: string
    error_message?: string
    smtp_message_id?: string
  }
): Promise<void> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const setParams: any = { status }
  if (extra?.sent_at) setParams.sent_at = extra.sent_at
  if (extra?.replied_at) setParams.replied_at = extra.replied_at
  if (extra?.error_message) setParams.error_message = extra.error_message
  if (extra?.smtp_message_id) setParams.smtp_message_id = extra.smtp_message_id

  await repo.update(id, setParams)
}

export async function getDueOutreach(): Promise<OutreachRecord[]> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const qb = repo.createQueryBuilder('outreach')
  const res = await qb
    .where('outreach.status = :status', { status: 'queued' })
    .andWhere("outreach.scheduled_at <= datetime('now')")
    .orderBy('outreach.scheduled_at', 'ASC')
    .getMany()
  return res as OutreachRecord[]
}

export async function getSequenceSummaries(
  pagination?: import('../../types').PaginationParams
): Promise<import('../../types').PaginatedResponse<SequenceSummary>> {
  const ds = getDataSource()
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const countRes = await ds.query(`SELECT COUNT(DISTINCT lead_id) as count FROM outreach`)
  const total = Number(countRes[0]?.count) || 0

  const data = await ds.query(`
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
    LIMIT ? OFFSET ?
  `, [pageSize, offset])

  return { data: data as SequenceSummary[], total }
}
