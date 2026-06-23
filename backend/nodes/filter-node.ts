// backend/nodes/filter-node.ts
// Drops records that don't match a condition.

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, mainOutput, mainInput } from './descriptors'
import { evalCondition } from '../engine/graph'
import type { NodeHandler } from '../engine/types'

export function registerFilterNode() {
  const handler: NodeHandler = {
    type: 'filter',
    async execute(ctx) {
      const condition = ctx.config.condition as string
      if (!condition) {
        // No filter: pass all
        for (const rec of ctx.incoming) ctx.emit(rec)
        return
      }
      let kept = 0, dropped = 0
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        if (evalCondition(condition, rec.data)) { ctx.emit(rec); kept++ }
        else dropped++
      }
      ctx.log('info', `Filter: ${kept} kept, ${dropped} dropped`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'filter',
    name: 'Filter',
    description: 'Drops records that do not match a condition.',
    category: 'Logic',
    icon: 'Filter',
    color: '#64748b',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      condition: textField('Condition', true, 'JS expression against record data. e.g. "data.email !== null && data.ai_site_score >= 50"'),
    },
  })

  registerNode(handler, descriptor)
}
