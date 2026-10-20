// backend/nodes/delay-node.ts
import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerDelayNode() {
  const handler: NodeHandler = {
    type: 'delay',
    async execute(ctx) {
      const ms = Number(ctx.config.ms) || 1000
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()
        await new Promise(r => setTimeout(r, ms))
        ctx.emit(rec)
      }
      ctx.log('info', `Delayed ${ctx.incoming.length} record(s) by ${ms}ms`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'delay',
    name: 'Delay',
    description: 'Waits a fixed duration between processing each record (rate limiting).',
    category: 'Advanced',
    icon: 'Clock',
    color: '#94a3b8',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      ms: strField('Delay (ms)', false, 'Milliseconds to wait per record.', '1000'),
    },
  })

  registerNode(handler, descriptor)
}
