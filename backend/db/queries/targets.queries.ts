import { getTenantId } from './tenant'
// src/db/queries/targets.queries.ts
import { getDataSource } from '../index'
import { ScrapeTargetEntity } from '../entities/ScrapeTargetEntity'
import type { ScrapeTarget, ScrapeTargetInsert } from '../../../shared/types/pipeline.types'

export async function getAllTargets(): Promise<ScrapeTarget[]> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  return await repo.find({
    where: { org_id: getTenantId() },
    order: { created_at: 'DESC' }
  }) as ScrapeTarget[]
}

export async function getActiveTargets(): Promise<ScrapeTarget[]> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  return await repo.find({
    where: { status: 'active', org_id: getTenantId() },
    order: { created_at: 'ASC' }
  }) as ScrapeTarget[]
}

export async function insertTarget(data: ScrapeTargetInsert): Promise<ScrapeTarget> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  const target = repo.create({
    org_id: getTenantId(),
    label: data.label,
    query: data.query,
    city: data.city,
    country: data.country,
    max_per_run: data.max_per_run,
    min_ai_score: data.min_ai_score,
    website_filter: data.website_filter,
    use_proxy: data.use_proxy
  })
  return await repo.save(target) as ScrapeTarget
}

export async function updateTarget(id: number, patch: Partial<ScrapeTarget>): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  if (Object.keys(patch).length === 0) return
  await repo.update({ id, org_id: getTenantId() }, patch)
}

export async function toggleTarget(id: number): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  const target = await repo.findOneBy({ id, org_id: getTenantId() })
  if (target) {
    target.status = target.status === 'active' ? 'paused' : 'active'
    await repo.save(target)
  }
}

export async function deleteTarget(id: number): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  await repo.delete({ id, org_id: getTenantId() })
}

export async function markTargetRun(id: number, found: number): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeTargetEntity)
  const target = await repo.findOneBy({ id, org_id: getTenantId() })
  if (target) {
    target.last_run_at = new Date().toISOString()
    target.total_found += found
    await repo.save(target)
  }
}
