import { getDataSource, isDbInitialized } from '@sdk/backend/db'
import { AuditLogEntity } from '@sdk/backend/db/entities/AuditLogEntity'
import { getTenantId, getCurrentUserId } from '@sdk/backend/db/queries/tenant'

export interface LogAuditParams {
  action: string
  resourceType: string
  resourceId: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  orgId?: number
  userId?: number
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    if (!isDbInitialized()) return
    const ds = getDataSource()
    if (!ds?.isInitialized) return
    const repo = ds.getRepository(AuditLogEntity)
    const orgId = params.orgId ?? getTenantId()
    const userId = params.userId ?? getCurrentUserId()

    await repo.save(repo.create({
      org_id: orgId,
      user_id: userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: String(params.resourceId),
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ip_address: params.ipAddress ?? null,
    }))
  } catch (err) {
    console.warn('[AuditService] Failed to record audit event:', err)
  }
}
