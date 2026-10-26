import { getTenantId } from './tenant'
import { getDataSource, isDbInitialized } from '../index'
import { SuppressionEntity, type SuppressionType, type SuppressionReason } from '../entities/SuppressionEntity'

export interface SuppressionInput {
  org_id?: number
  type?: SuppressionType
  value: string
  reason?: SuppressionReason
}

function getSuppressionRepo() {
  const ds = getDataSource()
  return ds.hasMetadata(SuppressionEntity)
    ? ds.getRepository(SuppressionEntity)
    : ds.getRepository<SuppressionEntity>('SuppressionEntity')
}

/** Check whether an email address, domain, or phone is on the organization's DNC suppression list. */
export async function isSuppressed(target: string, customOrgId?: number): Promise<boolean> {
  if (!target || !isDbInitialized()) return false
  const orgId = customOrgId ?? getTenantId()
  const cleanTarget = target.trim().toLowerCase()

  const repo = getSuppressionRepo()
  
  // Direct match
  const directMatch = await repo.findOne({
    where: { org_id: orgId, value: cleanTarget },
  })
  if (directMatch) return true

  // If email, also check domain suppression
  if (cleanTarget.includes('@')) {
    const domain = cleanTarget.split('@')[1]
    if (domain) {
      const domainMatch = await repo.findOne({
        where: { org_id: orgId, value: domain },
      })
      if (domainMatch) return true
    }
  }

  return false
}

/** Add a single value to the DNC suppression list. */
export async function addSuppression(input: SuppressionInput): Promise<SuppressionEntity | null> {
  if (!isDbInitialized()) return null
  const orgId = input.org_id ?? getTenantId()
  const value = input.value.trim().toLowerCase()

  // Auto-detect type if not explicitly supplied
  let type: SuppressionType = input.type || 'email'
  if (!input.type) {
    if (value.includes('@')) type = 'email'
    else if (value.includes('.') && !value.startsWith('+')) type = 'domain'
    else type = 'phone'
  }

  const repo = getSuppressionRepo()
  const existing = await repo.findOne({ where: { org_id: orgId, value } })
  if (existing) return existing

  const entity = repo.create({
    org_id: orgId,
    type,
    value,
    reason: input.reason || 'manual',
  })
  return await repo.save(entity)
}

/** Batch add multiple values (comma/newline separated or array) to DNC suppression list. */
export async function batchAddSuppressions(
  values: string[],
  type?: SuppressionType,
  reason: SuppressionReason = 'manual',
  customOrgId?: number
): Promise<{ added: number; skipped: number }> {
  if (!isDbInitialized()) return { added: 0, skipped: 0 }
  const orgId = customOrgId ?? getTenantId()
  let added = 0
  let skipped = 0

  for (const raw of values) {
    const val = raw.trim().toLowerCase()
    if (!val) continue
    try {
      const res = await addSuppression({ org_id: orgId, value: val, type, reason })
      if (res) added++
      else skipped++
    } catch {
      skipped++
    }
  }

  return { added, skipped }
}

/** Get all suppressed entities with optional search and pagination. */
export async function getAllSuppressions(
  customOrgId?: number,
  pagination?: { page?: number; pageSize?: number; search?: string }
): Promise<{ data: SuppressionEntity[]; total: number }> {
  if (!isDbInitialized()) return { data: [], total: 0 }
  const orgId = customOrgId ?? getTenantId()
  const repo = getSuppressionRepo()
  const qb = repo.createQueryBuilder('sup')
  qb.where('sup.org_id = :orgId', { orgId })

  if (pagination?.search) {
    qb.andWhere('sup.value LIKE :search', { search: `%${pagination.search.toLowerCase()}%` })
  }

  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  qb.skip((page - 1) * pageSize).take(pageSize).orderBy('sup.created_at', 'DESC')

  const [data, total] = await qb.getManyAndCount()
  return { data, total }
}

/** Remove an item from the DNC suppression list. */
export async function removeSuppression(id: number, customOrgId?: number): Promise<boolean> {
  if (!isDbInitialized()) return false
  const orgId = customOrgId ?? getTenantId()
  const repo = getSuppressionRepo()
  const res = await repo.delete({ id, org_id: orgId })
  return (res.affected || 0) > 0
}
