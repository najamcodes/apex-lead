// backend/nodes/connector-node.ts
// Fire-and-forget to external systems (webhook, Discord, Slack, etc.)

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, mainOutput, mainInput } from './descriptors'
import { getAllPlugins } from '../../plugins/registry'
import { fireConnectors } from '../../plugins/runner'
import type { PluginTrigger } from '../../plugins/types'
import type { NodeHandler } from '../engine/types'

export function registerConnectorNode() {
  const handler: NodeHandler = {
    type: 'connector',
    async execute(ctx) {
      const pluginId = ctx.config.plugin as string | undefined
      const trigger = (ctx.config.trigger as PluginTrigger) || 'lead.created'

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        try {
          // If a specific connector plugin is configured, only fire that one.
          // Otherwise fire all enabled connectors subscribed to this trigger.
          const { getEnabledConnectors } = await import('../../plugins/registry')
          const connectors = pluginId
            ? getEnabledConnectors(trigger).filter(r => r.manifest.id === pluginId)
            : getEnabledConnectors(trigger)

          if (connectors.length === 0) {
            ctx.log('warn', `No connectors enabled for trigger '${trigger}'`)
            ctx.emit(rec)
            continue
          }

          const { fireConnectors, makeLeadSnapshot } = await import('../../plugins/runner')
          const snapshot = makeLeadSnapshot(rec.data)
          const result = await fireConnectors(trigger, snapshot)
          ctx.log('info', `Connectors fired: ${result.fired} ok, ${result.errors} failed`)
          ctx.emit(rec)
        } catch (err) {
          ctx.log('error', `Connector failed: ${err instanceof Error ? err.message : String(err)}`)
          ctx.emit(rec)
        }
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'connector',
    name: 'Connector',
    description: 'Pushes records to external systems (webhook, Discord, Zapier, etc.) via connector plugins.',
    category: 'Output',
    icon: 'Share2',
    color: '#a855f7',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      plugin: selectField('Connector plugin', [], 'Specific connector to fire. Empty = all enabled.'),
      trigger: selectField('Trigger', [
        'lead.created', 'lead.qualified', 'lead.approved', 'lead.skipped', 'lead.closed',
        'outreach.sent', 'outreach.replied', 'outreach.bounced',
      ], 'Event type to emit.', 'lead.created'),
    },
  })

  registerNode(handler, descriptor)
}
