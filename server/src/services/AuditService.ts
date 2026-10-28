import { getDataSource } from '../db'
import { AuditLogEntity } from '../db/entities/AuditLogEntity'

export interface LogAuditEventDto {
  orgId: number
  userId?: number | null
  action: string
  resourceType: string
  resourceId?: string | number | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

export class AuditService {
  async log(event: LogAuditEventDto): Promise<void> {
    try {
      const repo = getDataSource().getRepository(AuditLogEntity)
      const entry = repo.create({
        org_id: event.orgId,
        user_id: event.userId ?? null,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId ? String(event.resourceId) : 'none',
        metadata: JSON.stringify(event.metadata || {}),
        ip_address: event.ipAddress || null,
      })
      await repo.save(entry)
    } catch (err) {
      console.warn('[AuditService] Failed to record audit log:', err)
    }
  }

  async listAuditLogs(orgId: number, limit = 50, offset = 0) {
    const repo = getDataSource().getRepository(AuditLogEntity)
    const [items, total] = await repo.findAndCount({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    })
    return { items, total }
  }
}
