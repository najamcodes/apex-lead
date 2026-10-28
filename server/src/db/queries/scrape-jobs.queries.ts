import { getTenantId, getCurrentUserId, getUserScopeFilter, canViewAllData } from './tenant'
import { getDataSource } from '../index'
import { ScrapeJobEntity } from '../entities/ScrapeJobEntity'
import type { ScrapeJob } from '@sdk/core/types/scraper.types'
import { In, type FindOptionsWhere } from 'typeorm'

export async function insertScrapeJob(
  job: Omit<
    ScrapeJob,
    'progress' | 'found' | 'errors' | 'started_at' | 'completed_at' | 'error_message'
  >
): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  await repo.save(repo.create({
    org_id: getTenantId(),
    created_by_user_id: getCurrentUserId(),
    id: job.id,
    query: job.query,
    city: job.city,
    country: job.country,
    max_results: job.max_results,
    status: job.status
  }))
}

export async function updateScrapeJob(id: string, patch: Partial<ScrapeJob>): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  await repo.update({ id, org_id: getTenantId() }, patch)
}

export async function getAllScrapeJobs(
  pagination?: import('@sdk/core/types').PaginationParams
): Promise<import('@sdk/core/types').PaginatedResponse<ScrapeJob>> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const qb = repo.createQueryBuilder('job')
  qb.where('job.org_id = :orgId', { orgId: getTenantId() })

  const scope = getUserScopeFilter('job')
  if (scope.clause) {
    qb.andWhere(scope.clause.replace('scraped_by_user_id', 'created_by_user_id').replace('AND ', ''), scope.params)
  }

  qb.orderBy('job.started_at', 'DESC')
  qb.skip(offset).take(pageSize)

  const [data, total] = await qb.getManyAndCount()
  return { data: data as ScrapeJob[], total }
}

export async function getScrapeJobById(id: string): Promise<ScrapeJob | null> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  const where: FindOptionsWhere<ScrapeJobEntity> = { id, org_id: getTenantId() }
  if (!canViewAllData()) {
    where.created_by_user_id = getCurrentUserId()
  }
  const res = await repo.findOne({ where })
  return (res as ScrapeJob) || null
}

export async function deleteScrapeJob(id: string): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  const where: FindOptionsWhere<ScrapeJobEntity> = { id, org_id: getTenantId() }
  if (!canViewAllData()) {
    where.created_by_user_id = getCurrentUserId()
  }
  await repo.delete(where)
}

export async function deleteScrapeJobs(ids: string[]): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  const where: FindOptionsWhere<ScrapeJobEntity> = { id: In(ids), org_id: getTenantId() }
  if (!canViewAllData()) {
    where.created_by_user_id = getCurrentUserId()
  }
  await repo.delete(where)
}
