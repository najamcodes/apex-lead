// backend/nodes/connector-node.ts
// Fire-and-forget to external systems via connector plugins or a custom webhook.
// Decoupled from lead-gen: the event and payload are fully user-configurable.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, textField, mainOutput, mainInput, getPath } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerConnectorNode() {
  const handler: NodeHandler = {
    type: 'connector',
    async execute(ctx) {
      const pluginId = ctx.config.plugin as string | undefined
      const event = (ctx.config.event as string) || 'record.processed'
      const payloadTemplate = ctx.config.payload_template as string | undefined

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        try {
          // Build payload
          let payload: Record<string, unknown> = rec.data
          if (payloadTemplate) {
            try {
              const resolved = payloadTemplate.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
                const path = expr.trim().replace(/^(record|input)\./, '')
                const val = getPath(path, { ...ctx.input, ...rec.data })
                return val !== undefined ? String(val) : ''
              })
              payload = JSON.parse(resolved)
            } catch {
              payload = rec.data
            }
          }

          // Fire specific plugin if configured
          if (pluginId) {
            const { getAllPlugins } = await import('../../plugins/registry')
            const all = getAllPlugins()
            const pluginRecord = all.find(r => r.manifest.id === pluginId && r.manifest.kind === 'connector')
            if (!pluginRecord || !pluginRecord.enabled) {
              ctx.log('warn', `Connector plugin '${pluginId}' not enabled or not found`)
              ctx.emit(rec)
              continue
            }
            const { makeLeadSnapshot, fireConnectors } = await import('../../plugins/runner')
            const snapshot = makeLeadSnapshot(payload)
            const result = await fireConnectors(event as any, snapshot)
            ctx.log('info', `Connector plugin fired: ${result.fired} ok, ${result.errors} failed`)
          } else {
            // Fire all enabled connectors subscribed to this event
            const { getEnabledConnectors } = await import('../../plugins/registry')
            const connectors = getEnabledConnectors(event as any)
            if (connectors.length === 0) {
              ctx.log('info', `No connectors subscribed to event '${event}' — skipping`)
            } else {
              const { fireConnectors, makeLeadSnapshot } = await import('../../plugins/runner')
              const snapshot = makeLeadSnapshot(payload)
              const result = await fireConnectors(event as any, snapshot)
              ctx.log('info', `Fired ${result.fired} connectors for '${event}', ${result.errors} failed`)
            }
          }
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
    description: 'Push records to external systems (Discord, webhooks, Zapier, etc.) via connector plugins. Event and payload are fully configurable.',
    category: 'Output',
    icon: 'Share2',
    color: '#a855f7',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      plugin: selectField('Connector plugin', [],
        'Specific plugin to fire. Leave empty to fire all enabled connectors for this event.'),
      event: strField('Event name', false,
        'Event to emit. Built-in: lead.created, lead.approved. Or any custom string.',
        'record.processed'),
      payload_template: textField('Payload template (JSON)', false,
        'Optional JSON template with {{record.field}} substitution. If empty, the full record data is sent.'),
    },
    help: 'Events are dispatched to all enabled connector plugins that subscribe to the event name.\n\nBuilt-in events:\n• lead.created, lead.qualified, lead.approved, lead.skipped\n• outreach.sent, outreach.replied, outreach.bounced\n• record.processed (generic)\n\nInstall connector plugins (Discord, Zapier, Webhook) in Settings → Plugins.',
  })

  registerNode(handler, descriptor)
}
