import { getTenantId } from './tenant'
// src/db/queries/digests.queries.ts
import { getDataSource } from '../index'
import { DigestRunEntity } from '../entities/DigestRunEntity'
import type { DigestRun } from '../../../shared/types/pipeline.types'

export async function insertDigestRun(data: Omit<DigestRun, 'id'>): Promise<DigestRun> {
  const repo = getDataSource().getRepository(DigestRunEntity)
  const entity = repo.create({
    org_id: getTenantId(),
    run_at: data.run_at,
    targets_run: data.targets_run,
    total_scraped: data.total_scraped,
    total_qualified: data.total_qualified,
    total_no_website: data.total_no_website,
    total_new: data.total_new,
    digest_sent: data.digest_sent,
    digest_error: data.digest_error,
    top_leads: typeof data.top_leads === 'string' ? data.top_leads : JSON.stringify(data.top_leads)
  })
  return await repo.save(entity) as unknown as DigestRun
}

export async function getAllDigests(limit = 30): Promise<DigestRun[]> {
  const repo = getDataSource().getRepository(DigestRunEntity)
  return await repo.find({
    where: { org_id: getTenantId() },
    order: { run_at: 'DESC' },
    take: limit
  }) as unknown as DigestRun[]
}

export async function getLatestDigest(): Promise<DigestRun | null> {
  const repo = getDataSource().getRepository(DigestRunEntity)
  const result = await repo.findOne({
    where: { org_id: getTenantId() },
    order: { run_at: 'DESC' }
  })
  return result ? (result as unknown as DigestRun) : null
}
