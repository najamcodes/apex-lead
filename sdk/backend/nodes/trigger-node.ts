// backend/nodes/trigger-node.ts
// Starts a pipeline run. Supports manual, cron, webhook, and event sub-types.
// The trigger config is stored in the node config and used by the scheduler + webhook router.

import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, jsonField, selectField, mainOutput } from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerTriggerNode() {
  const handler: NodeHandler = {
    type: 'trigger',
    async execute(ctx) {
      // Determine seed data: merge config seed + run input
      let seedData: Record<string, unknown> = {}
      const configSeed = ctx.config.seed
      if (configSeed && typeof configSeed === 'object') {
        seedData = { ...configSeed as Record<string, unknown> }
      }
      // Run input (passed from webhook body, cron runner, or manual "Run" button) takes precedence
      if (ctx.input && typeof ctx.input === 'object' && Object.keys(ctx.input).length > 0) {
        seedData = { ...seedData, ...ctx.input }
      }

      const triggerType = (ctx.config.type as string) || 'manual'
      ctx.log('info', `Trigger fired (${triggerType})`)

      const rec: PipelineRecord = {
        id: `${ctx.runId}-seed`,
        collection: (ctx.config.collection as string) || 'trigger',
        data: {
          ...seedData,
          _trigger_type: triggerType,
          _triggered_at: new Date().toISOString(),
        },
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
    },
  }

  const descriptor = makeDescriptor({
    type: 'trigger',
    name: 'Trigger',
    description: 'Starts a pipeline run. Configure the trigger type — manual (run button), cron (schedule), webhook (HTTP), or internal event.',
    category: 'Trigger',
    icon: 'Play',
    color: '#10b981',
    isStart: true,
    produces: true,
    outputs: [mainOutput],
    configSchema: {
      type: selectField('Trigger type', ['manual', 'cron', 'webhook', 'event'],
        'How this pipeline is activated.', 'manual'),
      cron: strField('Cron expression', false,
        'For cron triggers. e.g. "0 9 * * *" = every day at 9am. "*/5 * * * *" = every 5 minutes.'),
      webhook_slug: strField('Webhook slug', false,
        'Auto-generated unique ID. POST to /api/pipelines/webhook/{slug} to trigger this pipeline. Leave blank to auto-generate.'),
      event: strField('Event name', false,
        'For event triggers. Internal app events: lead.created, lead.approved, outreach.replied'),
      collection: strField('Output collection', false,
        'Collection label for the seed record produced by this trigger.', 'trigger'),
      seed: jsonField('Seed data', 'Static data merged into the trigger record. Useful for hardcoding config values.'),
    },
    help: 'Trigger types:\n• manual — only runs when you click "Run Pipeline"\n• cron — runs on a schedule (e.g. "0 9 * * 1-5" = weekdays at 9am)\n• webhook — receives an HTTP POST; the request body becomes the seed record\n• event — fires on internal app events like lead.approved\n\nSeed data fields are available to all downstream nodes via {{input.field_name}}.',
  })

  registerNode(handler, descriptor)
}
