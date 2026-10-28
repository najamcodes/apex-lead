import type { WorkerNodeEntity } from '../db/entities/WorkerNodeEntity';

export interface WorkerNodeResponseDto {
  id: string;
  orgId: number;
  userId: number | null;
  name: string;
  hostname: string | null;
  platform: string;
  status: string;
  ipAddress: string | null;
  maxConcurrency: number;
  activeJobs: number;
  capabilities: string[];
  version: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class WorkerResponseAdapter {
  static toDto(entity: WorkerNodeEntity | null | undefined): WorkerNodeResponseDto | null {
    if (!entity) return null;

    let parsedCaps: string[] = [];
    if (entity.capabilities) {
      try {
        parsedCaps = typeof entity.capabilities === 'string'
          ? JSON.parse(entity.capabilities)
          : entity.capabilities;
      } catch {
        parsedCaps = [];
      }
    }

    return {
      id: entity.id,
      orgId: entity.org_id,
      userId: entity.user_id,
      name: entity.name,
      hostname: entity.hostname || null,
      platform: entity.platform || 'unknown',
      status: entity.status || 'offline',
      ipAddress: entity.ip_address || null,
      maxConcurrency: entity.max_concurrency ?? 2,
      activeJobs: entity.active_jobs ?? 0,
      capabilities: parsedCaps,
      version: entity.version || null,
      lastHeartbeatAt: entity.last_heartbeat_at || null,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  static toDtoList(entities: (WorkerNodeEntity | null | undefined)[]): WorkerNodeResponseDto[] {
    return entities
      .map((e) => WorkerResponseAdapter.toDto(e))
      .filter((dto): dto is WorkerNodeResponseDto => dto !== null);
  }
}
