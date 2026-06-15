import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { ScrapeJobEntity } from '../entities/ScrapeJobEntity'
import type { ScrapeJob } from '../../types/scraper.types'
import { In } from 'typeorm'

export async function insertScrapeJob(
  job: Omit<
    ScrapeJob,
    'progress' | 'found' | 'errors' | 'started_at' | 'completed_at' | 'error_message'
  >
): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  await repo.save(repo.create({
    org_id: getTenantId(),
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
  pagination?: import('../../types').PaginationParams
): Promise<import('../../types').PaginatedResponse<ScrapeJob>> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const [data, total] = await repo.findAndCount({
    where: { org_id: getTenantId() },
    order: { started_at: 'DESC' },
    skip: offset,
    take: pageSize
  })

  return { data: data as ScrapeJob[], total }
}

export async function getScrapeJobById(id: string): Promise<ScrapeJob | null> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  const res = await repo.findOne({ where: { id, org_id: getTenantId() } })
  return (res as ScrapeJob) || null
}

export async function deleteScrapeJob(id: string): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  await repo.delete({ id, org_id: getTenantId() })
}

export async function deleteScrapeJobs(ids: string[]): Promise<void> {
  const repo = getDataSource().getRepository(ScrapeJobEntity)
  await repo.delete({ id: In(ids), org_id: getTenantId() })
}
