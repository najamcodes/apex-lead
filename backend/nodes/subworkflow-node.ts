// backend/nodes/subworkflow-node.ts
// Executes a nested sub-pipeline DAG with incoming records as input and emits its output records.

import type { NodeExecutionContext } from '../engine/types'
import { registerNode } from '../engine/registry'
import { getDataSource } from '../db'
import { PipelineDefinitionEntity } from '../db/entities/PipelineDefinitionEntity'
import { executePipeline, getRunState } from '../engine/graph'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

export function registerSubworkflowNode(): void {
  const handler = {
    type: 'subworkflow' as const,
    async execute(ctx: NodeExecutionContext): Promise<void> {
      const subPipelineId = ctx.config.sub_pipeline_id as string
      if (!subPipelineId) {
        ctx.log('error', 'subworkflow node: no sub_pipeline_id specified')
        return
      }

      // Recursion protection: prevent cyclical sub-pipeline calls
      const currentTrace = ctx.incoming[0]?.meta?.trace || []
      const subWorkflowOccurrences = currentTrace.filter(id => id === ctx.nodeId || id === subPipelineId).length
      if (subWorkflowOccurrences > 5) {
        ctx.log('error', `subworkflow node: maximum recursion depth exceeded for pipeline ${subPipelineId}`)
        return
      }

      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const subRow = await repo.findOneBy({ id: subPipelineId, org_id: ctx.orgId })
      if (!subRow) {
        ctx.log('error', `subworkflow node: pipeline ${subPipelineId} not found in org ${ctx.orgId}`)
        return
      }

      const graph = JSON.parse(subRow.graph || '{"nodes":[],"edges":[]}')
      const subPipelineDef = {
        id: subRow.id,
        org_id: subRow.org_id,
        name: subRow.name,
        description: subRow.description ?? undefined,
        collection: subRow.collection,
        status: subRow.status as any,
        nodes: graph.nodes || [],
        edges: graph.edges || [],
        version: subRow.version,
        created_at: subRow.created_at,
        updated_at: subRow.updated_at,
      }

      const incoming = ctx.incoming.length > 0 ? ctx.incoming : [{
        id: `seed-${Date.now()}`,
        collection: subRow.collection,
        data: ctx.input,
        meta: {
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          sourceNodeId: ctx.nodeId,
          orgId: ctx.orgId,
          createdAt: new Date().toISOString(),
          trace: [...currentTrace, ctx.nodeId],
        },
      }]

      ctx.log('info', `Running sub-workflow '${subRow.name}' with ${incoming.length} record(s)`)

      for (const rec of incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const subHandle = await executePipeline(subPipelineDef, {
          input: { ...ctx.input, ...rec.data },
          userRole: ctx.userRole,
          proxyConfig: ctx.proxyConfig,
        })

        // Wait until sub-workflow finishes
        const start = Date.now()
        while (!subHandle.isDone() && Date.now() - start < 120000) {
          if (ctx.isCancelled()) {
            subHandle.cancel()
            break
          }
          await new Promise(r => setTimeout(r, 500))
        }

        const state = getRunState(subHandle)
        const subSnapshots = state.snapshots || {}

        // Collect outputs from the sub-pipeline's terminal or storage nodes
        const emittedOutputData: any[] = []
        for (const snap of Object.values(subSnapshots) as Array<{ inputs: any[]; outputs: any[] }>) {
          if (snap?.outputs && snap.outputs.length > 0) {
            emittedOutputData.push(...snap.outputs)
          }
        }

        // If sub-pipeline produced explicit output snapshots, emit those; otherwise pass-through the record with sub-run metadata
        if (emittedOutputData.length > 0) {
          const outRecords: PipelineRecord[] = emittedOutputData.map((data, idx) => ({
            id: `${rec.id}-sub-${idx}`,
            collection: ctx.incoming[0]?.collection || subRow.collection,
            data: { ...rec.data, ...data, _sub_pipeline: subRow.name },
            meta: {
              ...rec.meta,
              sourceNodeId: ctx.nodeId,
              trace: [...(rec.meta?.trace || []), ctx.nodeId],
            },
          }))
          ctx.emit(outRecords)
        } else {
          ctx.emit({
            ...rec,
            data: { ...rec.data, _sub_workflow_status: subHandle.isDone() ? 'completed' : 'failed' },
            meta: {
              ...rec.meta,
              sourceNodeId: ctx.nodeId,
              trace: [...(rec.meta?.trace || []), ctx.nodeId],
            },
          })
        }
      }
    },
  }

  const descriptor = {
    type: 'subworkflow' as const,
    name: 'Sub-Workflow',
    description: 'Execute another pipeline as a modular sub-workflow component and pipe its output downstream.',
    category: 'Advanced' as const,
    icon: 'Layers',
    color: '#6366f1',
    isStart: false,
    inputs: [
      {
        id: 'main',
        label: 'Input Records',
        schema: { fields: {}, multiple: true, description: 'Records to feed into the sub-pipeline' },
      },
    ],
    outputs: [
      {
        id: 'main',
        label: 'Sub-Workflow Output',
        schema: { fields: {}, multiple: true, description: 'Records emitted by the sub-pipeline' },
      },
    ],
    produces: true,
    configSchema: {
      sub_pipeline_id: {
        type: 'string',
        label: 'Sub-Pipeline ID',
        description: 'The target pipeline to execute as a sub-workflow',
        required: true,
      },
      wait_for_completion: {
        type: 'boolean',
        label: 'Wait For Completion',
        default: true,
      },
    },
  }

  registerNode(handler, descriptor)
}
