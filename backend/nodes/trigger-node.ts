// backend/nodes/trigger-node.ts
import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, jsonField, selectField, mainOutput } from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

export function registerTriggerNode() {
  const handler: NodeHandler = {
    type: 'trigger',
    async execute(ctx) {
      // Trigger nodes produce a single seed record from the run input.
      // The actual scraping/producing happens downstream.
      const rec: PipelineRecord = {
        id: `${ctx.runId}-seed`,
        collection: 'trigger',
        data: ctx.input,
        meta: {
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          sourceNodeId: ctx.nodeId,
          orgId: ctx.orgId,
          createdAt: new Date().toISOString(),
          trace: [ctx.nodeId],
        },
      }
      ctx.emit(rec)
      ctx.log('info', 'Trigger fired')
    },
  }

  const descriptor = makeDescriptor({
    type: 'trigger',
    name: 'Trigger',
    description: 'Starts a pipeline run (manual, cron, webhook, or event).',
    category: 'Trigger',
    icon: 'Play',
    color: '#10b981',
    isStart: true,
    produces: true,
    outputs: [mainOutput],
    configSchema: {
      type: selectField('Trigger type', ['manual', 'cron', 'webhook', 'event'], 'How this pipeline starts.'),
      cron: strField('Cron expression', false, 'For cron triggers, e.g. "0 9 * * *".'),
      event: strField('Event name', false, 'For event triggers, e.g. "lead.created".'),
      seed: jsonField('Seed data', 'Initial data passed into the pipeline.'),
    },
  })

  registerNode(handler, descriptor)
}
