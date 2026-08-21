// electron/scheduler/pipeline-scheduler.ts
// Schedules and executes active pipelines that have a 'cron' trigger configured.

import * as cron from 'node-cron'
import { getDataSource } from '../../backend/db'
import { PipelineDefinitionEntity } from '../../backend/db/entities/PipelineDefinitionEntity'
import { PipelineRunEntity } from '../../backend/db/entities/PipelineRunEntity'
import { executePipeline, getRunState } from '../../backend/engine/graph'
import { registerBuiltInNodes } from '../../backend/nodes'
import { randomUUID } from 'crypto'
import type { PipelineDefinition, PipelineNode, NodeEdge } from '../../shared/types/pipeline.types'

let pipelineTasks: cron.ScheduledTask[] = []

export async function initPipelineScheduler(): Promise<void> {
  // Clear any existing pipeline cron tasks
  pipelineTasks.forEach(t => t.stop())
  pipelineTasks = []

  registerBuiltInNodes()

  try {
    const repo = getDataSource().getRepository(PipelineDefinitionEntity)
    const activePipelines = await repo.find({ where: { status: 'active' } })

    for (const row of activePipelines) {
      let graph: { nodes: PipelineNode[]; edges: NodeEdge[] }
      try {
        graph = JSON.parse(row.graph)
      } catch {
        continue
      }

      // Check for trigger node with cron configuration or pipeline.trigger
      let cronExpr: string | undefined
      let seedData: Record<string, unknown> = {}

      const triggerNode = graph.nodes.find(n => n.type === 'trigger')
      if (triggerNode) {
        if (triggerNode.config.type === 'cron' && typeof triggerNode.config.cron === 'string') {
          cronExpr = triggerNode.config.cron.trim()
        }
        if (triggerNode.config.seed && typeof triggerNode.config.seed === 'object') {
          seedData = triggerNode.config.seed as Record<string, unknown>
        }
      }

      if (!cronExpr && row.trigger) {
        try {
          const parsed = JSON.parse(row.trigger)
          if (parsed.type === 'cron' && parsed.cron) {
            cronExpr = parsed.cron.trim()
          }
        } catch {}
      }

      if (cronExpr && cron.validate(cronExpr)) {
        const task = cron.schedule(cronExpr, async () => {
          console.log(`[PipelineScheduler] Running scheduled pipeline: ${row.name} (${row.id})`)
          const runId = randomUUID()
          const now = new Date().toISOString()

          const def: PipelineDefinition = {
            id: row.id,
            org_id: row.org_id,
            name: row.name,
            description: row.description ?? undefined,
            collection: row.collection,
            status: row.status as PipelineDefinition['status'],
            nodes: graph.nodes,
            edges: graph.edges,
            trigger: row.trigger ? JSON.parse(row.trigger) : undefined,
            proxy_id: row.proxy_id,
            min_role: row.min_role || 'user',
            role_gates: row.role_gates ? JSON.parse(row.role_gates) : null,
            version: row.version,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }

          const runRepo = getDataSource().getRepository(PipelineRunEntity)
          await runRepo.save(runRepo.create({
            id: runId,
            pipeline_id: row.id,
            org_id: row.org_id,
            created_by_user_id: null,
            status: 'running',
            started_at: now,
            input: JSON.stringify(seedData),
            stats: '{}',
            log: '[]',
          }))

          try {
            const handle = await executePipeline(def, {
              runId,
              input: seedData,
              userRole: 'system',
              onProgress: msg => console.log(`[cron ${row.name}] ${msg.nodeId ?? ''}: ${msg.message}`),
            })

            while (!handle.isDone()) {
              await new Promise(r => setTimeout(r, 2000))
              const state = getRunState(handle)
              await runRepo.update(runId, {
                stats: JSON.stringify(state.stats),
                log: JSON.stringify(state.log.slice(-200)),
              })
            }

            const state = getRunState(handle)
            await runRepo.update(runId, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              stats: JSON.stringify(state.stats),
              log: JSON.stringify(state.log.slice(-200)),
            })
          } catch (err) {
            console.error(`[PipelineScheduler] Error running pipeline ${row.id}:`, err)
            await runRepo.update(runId, {
              status: 'failed',
              completed_at: new Date().toISOString(),
              error: err instanceof Error ? err.message : String(err),
            })
          }
        })

        pipelineTasks.push(task)
        console.log(`[PipelineScheduler] Scheduled pipeline '${row.name}' with cron: ${cronExpr}`)
      }
    }
  } catch (err) {
    console.error('[PipelineScheduler] Failed to initialize pipeline scheduler:', err)
  }
}
