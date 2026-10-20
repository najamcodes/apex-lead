import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { OutreachEntity } from '../entities/OutreachEntity'
import type {
  OutreachRecord,
  OutreachInsert,
  OutreachStatus,
  SequenceSummary
} from '@sdk/core/types/outreach.types'

export async function insertOutreach(data: OutreachInsert): Promise<OutreachRecord> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const entity = repo.create({
    org_id: getTenantId(),
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
  pagination?: import('@sdk/core/types').PaginationParams
): Promise<import('@sdk/core/types').PaginatedResponse<OutreachRecord>> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const qb = repo.createQueryBuilder('outreach')
    .innerJoin('outreach.lead', 'lead')
    .where('outreach.org_id = :orgId', { orgId: getTenantId() })

  if (status) {
    qb.andWhere('outreach.status = :status', { status })
  }

  const { getUserScopeFilter } = require('./tenant')
  const scope = getUserScopeFilter('lead')
  if (scope.clause) {
    qb.andWhere(scope.clause.replace('AND ', ''), scope.params)
  }

  qb.orderBy('outreach.scheduled_at', status ? 'ASC' : 'DESC')
  qb.skip(offset).take(pageSize)

  const [data, total] = await qb.getManyAndCount()
  return { data: data as OutreachRecord[], total }
}

export async function getOutreachByLead(leadId: number): Promise<OutreachRecord[]> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const res = await repo.find({
    where: { lead_id: leadId, org_id: getTenantId() },
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

  await repo.update({ id, org_id: getTenantId() }, setParams)
}

export async function getDueOutreach(): Promise<OutreachRecord[]> {
  const repo = getDataSource().getRepository(OutreachEntity)
  const qb = repo.createQueryBuilder('outreach')
  const now = new Date().toISOString()
  const res = await qb
    .where('outreach.status = :status', { status: 'queued' })
    .andWhere('outreach.org_id = :orgId', { orgId: getTenantId() })
    .andWhere("outreach.scheduled_at <= :now", { now })
    .orderBy('outreach.scheduled_at', 'ASC')
    .getMany()
  return res as OutreachRecord[]
}

export async function getSequenceSummaries(
  pagination?: import('@sdk/core/types').PaginationParams
): Promise<import('@sdk/core/types').PaginatedResponse<SequenceSummary>> {
  const ds = getDataSource()
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const countRes = await ds.createQueryBuilder()
    .select('COUNT(DISTINCT lead_id)', 'count')
    .from('outreach', 'o')
    .innerJoin('leads', 'l', 'l.id = o.lead_id')
    .where('o.org_id = :orgId', { orgId: getTenantId() })
    
  const { getUserScopeFilter } = require('./tenant')
  const scope = getUserScopeFilter('l')
  if (scope.clause) {
    countRes.andWhere(scope.clause.replace('AND ', ''), scope.params)
  }

  const countResult = await countRes.getRawOne()
  const total = Number(countResult?.count) || 0

  const dataQb = ds.createQueryBuilder()
    .select('l.id', 'lead_id')
    .addSelect('l.business_name', 'business_name')
    .addSelect("MAX(CASE WHEN o.step = 1 THEN o.status END)", 'step1_status')
    .addSelect("MAX(CASE WHEN o.step = 2 THEN o.status END)", 'step2_status')
    .addSelect("MAX(CASE WHEN o.step = 3 THEN o.status END)", 'step3_status')
    .addSelect("MIN(CASE WHEN o.status = 'queued' THEN o.scheduled_at END)", 'next_scheduled')
    .from('leads', 'l')
    .innerJoin('outreach', 'o', 'o.lead_id = l.id')
    .where('l.org_id = :orgId', { orgId: getTenantId() })
    .groupBy('l.id')
    .orderBy('next_scheduled', 'ASC', 'NULLS LAST')
    .limit(pageSize)
    .offset(offset)
    
  if (scope.clause) {
    dataQb.andWhere(scope.clause.replace('AND ', ''), scope.params)
  }

  const data = await dataQb.getRawMany()

  return { data: data as SequenceSummary[], total }
}

export async function getPendingOutreachQueue(): Promise<any[]> {
  const ds = getDataSource()
  const qb = ds.createQueryBuilder()
    .select('o.id', 'id')
    .addSelect('o.step', 'step')
    .addSelect('o.subject', 'subject')
    .addSelect('o.scheduled_at', 'scheduled_at')
    .addSelect('l.business_name', 'business_name')
    .addSelect('l.email', 'email')
    .from('outreach', 'o')
    .innerJoin('leads', 'l', 'l.id = o.lead_id')
    .where('o.status = :status', { status: 'queued' })
    .andWhere('o.org_id = :orgId', { orgId: getTenantId() })
    .orderBy('o.scheduled_at', 'ASC')

  const { getUserScopeFilter } = require('./tenant')
  const scope = getUserScopeFilter('l')
  if (scope.clause) {
    qb.andWhere(scope.clause.replace('AND ', ''), scope.params)
  }

  const data = await qb.getRawMany()
  
  return data
}
