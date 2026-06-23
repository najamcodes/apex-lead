// backend/nodes/code-node.ts
// User-provided JavaScript sandbox. Advanced/power-user node.

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerCodeNode() {
  const handler: NodeHandler = {
    type: 'code',
    async execute(ctx) {
      const code = ctx.config.code as string
      if (!code) {
        ctx.log('error', 'No code provided')
        return
      }
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('record', 'input', 'config', 'emit', 'log', `'use strict';\n${code}`)
        for (const rec of ctx.incoming) {
          if (ctx.isCancelled()) break
          await ctx.isPaused()
          await fn(rec.data, ctx.input, ctx.config, (out: Record<string, unknown>) => {
            ctx.emit({ ...rec, data: { ...rec.data, ...out } })
          }, ctx.log)
          // If the user didn't emit, pass through
        }
      } catch (err) {
        ctx.log('error', `Code node failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'code',
    name: 'Code',
    description: 'Run custom JavaScript on each record. Use emit({...}) to output. Advanced.',
    category: 'Advanced',
    icon: 'Code',
    color: '#6366f1',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      code: textField('JavaScript', true, 'Available: record (data), input (mapped), config, emit(obj), log(level, msg).'),
    },
    help: 'Example:\nif (record.score > 80) emit({ promoted: true });\nlog("info", "Processed " + record.id);',
  })

  registerNode(handler, descriptor)
}
