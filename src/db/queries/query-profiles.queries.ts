import { getDataSource } from '../index'
import { QueryProfileEntity } from '../entities/QueryProfileEntity'
import type { QueryProfileInsert } from '../../types/pipeline.types'

export async function getAllQueryProfiles() {
  const repo = getDataSource().getRepository(QueryProfileEntity)
  return await repo.find({ order: { created_at: 'DESC' } })
}

export async function getActiveQueryProfiles() {
  const repo = getDataSource().getRepository(QueryProfileEntity)
  return await repo.find({ where: { status: 'active' } })
}

export async function insertQueryProfile(data: QueryProfileInsert) {
  const repo = getDataSource().getRepository(QueryProfileEntity)
  const profile = repo.create({
    label: data.label,
    target_audience: data.target_audience,
    core_offer: data.core_offer,
    cities: JSON.stringify(data.cities),
    countries: JSON.stringify(data.countries),
    status: data.status || 'active',
  })
  return await repo.save(profile)
}

export async function updateQueryProfileStatus(id: number, status: 'active' | 'paused' | 'error') {
  const repo = getDataSource().getRepository(QueryProfileEntity)
  await repo.update(id, { status, updated_at: () => "datetime('now')" })
}

export async function deleteQueryProfile(id: number) {
  const repo = getDataSource().getRepository(QueryProfileEntity)
  await repo.delete(id)
}

export async function incrementQueryProfileGenerated(id: number, count: number) {
  const repo = getDataSource().getRepository(QueryProfileEntity)
  await repo.increment({ id }, 'queries_generated', count)
}
