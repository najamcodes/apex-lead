// backend/nodes/branch-node.ts
// Conditional routing. Has two outputs: 'true' and 'false'.
// The actual filtering is done by edge.conditions set by the UI,
// but this node also supports an inline expression for convenience.

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, mainOutput } from './descriptors'
import { evalCondition } from '../engine/graph'
import type { NodeHandler } from '../engine/types'

export function registerBranchNode() {
  const handler: NodeHandler = {
    type: 'branch',
    async execute(ctx) {
      const condition = ctx.config.condition as string
      if (!condition) {
        // No inline condition: just pass everything through 'true' (UI uses edge conditions)
        for (const rec of ctx.incoming) ctx.emit(rec, 'true')
        return
      }
      let t = 0, f = 0
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        if (evalCondition(condition, rec.data)) {
          ctx.emit(rec, 'true'); t++
        } else {
          ctx.emit(rec, 'false'); f++
        }
      }
      ctx.log('info', `Branch: ${t} true, ${f} false`)
    },
  }

  const trueOutput = { id: 'true', label: 'True', schema: { fields: {}, multiple: true } }
  const falseOutput = { id: 'false', label: 'False', schema: { fields: {}, multiple: true } }

  const descriptor = makeDescriptor({
    type: 'branch',
    name: 'Branch (If/Else)',
    description: 'Routes records to the True or False output based on a condition.',
    category: 'Logic',
    icon: 'GitBranch',
    color: '#f97316',
    inputs: [mainOutput],
    outputs: [trueOutput, falseOutput],
    configSchema: {
      condition: textField('Condition', false, 'JS expression evaluated against record data. e.g. "data.ai_site_score >= 70" or "data.status === \'approved\'". Leave empty to use per-edge conditions.'),
    },
    help: 'Connect the True and False outputs to different downstream nodes. You can also use edge-level conditions for more granular routing.',
  })

  registerNode(handler, descriptor)
}
