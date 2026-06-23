import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { ActivityEntity } from '../entities/ActivityEntity'
import type { ActivityEvent, ActivityRecord } from '../../../shared/types/activity.types'

export async function logActivity(leadId: number, event: ActivityEvent, detail?: string): Promise<void> {
  const repo = getDataSource().getRepository(ActivityEntity)
  const activity = repo.create({
    org_id: getTenantId(),
    lead_id: leadId,
    event,
    detail: detail ?? null
  })
  await repo.save(activity)
}

export async function getActivityByLead(leadId: number, limit = 20): Promise<ActivityRecord[]> {
  const repo = getDataSource().getRepository(ActivityEntity)
  const rows = await repo.find({
    where: { lead_id: leadId, org_id: getTenantId() },
    order: { created_at: 'DESC' },
    take: limit
  })
  return rows as ActivityRecord[]
}

export async function getRecentActivity(limit = 30): Promise<(ActivityRecord & { business_name: string })[]> {
  const repo = getDataSource().getRepository(ActivityEntity)
  const rows = await repo.createQueryBuilder('activity')
    .innerJoinAndSelect('activity.lead', 'lead')
    .where('activity.org_id = :orgId', { orgId: getTenantId() })
    .orderBy('activity.created_at', 'DESC')
    .take(limit)
    .getMany()
  
  return rows.map(r => ({
    ...r,
    business_name: r.lead.business_name
  })) as (ActivityRecord & { business_name: string })[]
}
