import type { PipelineDefinitionEntity } from '../db/entities/PipelineDefinitionEntity';
import type { PipelineRunEntity } from '../db/entities/PipelineRunEntity';

export interface PipelineDefinitionDto {
  id: string;
  orgId: number;
  name: string;
  description: string | null;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  viewport?: Record<string, unknown>;
  enabled?: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRunDto {
  id: string;
  pipelineId: string;
  orgId: number;
  status: string;
  createdByUserId: number | null;
  input: Record<string, unknown>;
  stats: Record<string, unknown>;
  error?: string | null;
  log?: unknown[];
  startedAt: string;
  completedAt?: string | null;
}

export class PipelineResponseAdapter {
  static toDefinitionDto(entity: PipelineDefinitionEntity | null | undefined): PipelineDefinitionDto | null {
    if (!entity) return null;

    let graph = { nodes: [], edges: [] };
    if (entity.graph) {
      try {
        graph = typeof entity.graph === 'string' ? JSON.parse(entity.graph) : entity.graph;
      } catch {
        graph = { nodes: [], edges: [] };
      }
    }

    return {
      id: entity.id,
      orgId: entity.org_id,
      name: entity.name,
      description: entity.description || null,
      nodes: graph.nodes || [],
      edges: graph.edges || [],
      version: entity.version ?? 1,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  static toDefinitionList(entities: (PipelineDefinitionEntity | null | undefined)[]): PipelineDefinitionDto[] {
    return entities
      .map((e) => PipelineResponseAdapter.toDefinitionDto(e))
      .filter((dto): dto is PipelineDefinitionDto => dto !== null);
  }

  static toRunDto(entity: PipelineRunEntity | null | undefined): PipelineRunDto | null {
    if (!entity) return null;

    let parsedStats: Record<string, unknown> = {};
    if (entity.stats) {
      try {
        parsedStats = typeof entity.stats === 'string' ? JSON.parse(entity.stats) : entity.stats;
      } catch {
        parsedStats = {};
      }
    }

    let parsedInput: Record<string, unknown> = {};
    if (entity.input) {
      try {
        parsedInput = typeof entity.input === 'string' ? JSON.parse(entity.input) : entity.input;
      } catch {
        parsedInput = {};
      }
    }

    let parsedLog: unknown[] = [];
    if (entity.log) {
      try {
        parsedLog = typeof entity.log === 'string' ? JSON.parse(entity.log) : entity.log;
      } catch {
        parsedLog = [];
      }
    }

    return {
      id: entity.id,
      pipelineId: entity.pipeline_id,
      orgId: entity.org_id,
      status: entity.status,
      createdByUserId: entity.created_by_user_id,
      input: parsedInput,
      stats: parsedStats,
      error: entity.error || null,
      log: parsedLog,
      startedAt: entity.started_at,
      completedAt: entity.completed_at || null,
    };
  }

  static toRunList(entities: (PipelineRunEntity | null | undefined)[]): PipelineRunDto[] {
    return entities
      .map((e) => PipelineResponseAdapter.toRunDto(e))
      .filter((dto): dto is PipelineRunDto => dto !== null);
  }
}
