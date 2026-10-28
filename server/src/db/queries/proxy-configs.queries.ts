import { getDataSource } from '../index'
import { ProxyConfigEntity } from '../entities/ProxyConfigEntity'
import { getTenantId } from './tenant'
import type { ProxyConfigInsert, ProxyConfigUpdate } from '@sdk/core/types'

export async function getAllProxyConfigs(): Promise<ProxyConfigEntity[]> {
  const repo = getDataSource().getRepository(ProxyConfigEntity)
  return await repo.find({ where: { org_id: getTenantId() }, order: { created_at: 'DESC' } })
}

export async function getEnabledProxyConfigs(): Promise<ProxyConfigEntity[]> {
  const repo = getDataSource().getRepository(ProxyConfigEntity)
  return await repo.find({ where: { org_id: getTenantId(), enabled: true }, order: { created_at: 'DESC' } })
}

export async function getProxyConfigById(id: number): Promise<ProxyConfigEntity | null> {
  const repo = getDataSource().getRepository(ProxyConfigEntity)
  return await repo.findOne({ where: { id, org_id: getTenantId() } })
}

export async function createProxyConfig(data: ProxyConfigInsert): Promise<ProxyConfigEntity> {
  const repo = getDataSource().getRepository(ProxyConfigEntity)
  const config = repo.create({ ...data, org_id: getTenantId() })
  return await repo.save(config)
}

export async function updateProxyConfig(id: number, data: ProxyConfigUpdate): Promise<ProxyConfigEntity | null> {
  const repo = getDataSource().getRepository(ProxyConfigEntity)
  const config = await repo.findOne({ where: { id, org_id: getTenantId() } })
  if (!config) return null
  Object.assign(config, data)
  return await repo.save(config)
}

export async function deleteProxyConfig(id: number): Promise<boolean> {
  const repo = getDataSource().getRepository(ProxyConfigEntity)
  const result = await repo.delete({ id, org_id: getTenantId() })
  return (result.affected ?? 0) > 0
}

export async function getProxyConfigForPipeline(proxyId: number | null): Promise<ProxyConfigEntity | null> {
  if (!proxyId) return null
  return await getProxyConfigById(proxyId)
}