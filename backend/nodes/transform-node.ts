// backend/nodes/transform-node.ts
// Maps/transforms record fields using a declarative mapping config.

import { registerNode } from '../engine/registry'
import { makeDescriptor, jsonField, mainOutput, mainInput } from './descriptors'
import { applyMappings } from '../engine/graph'
import type { FieldMapping } from '../../shared/types/pipeline.types'
import type { NodeHandler } from '../engine/types'

export function registerTransformNode() {
  const handler: NodeHandler = {
    type: 'transform',
    async execute(ctx) {
      const mappings = (ctx.config.mappings as FieldMapping[]) || []
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        const transformed = applyMappings(mappings.length ? mappings : undefined, rec.data)
        ctx.emit({ ...rec, data: transformed })
      }
      ctx.log('info', `Transformed ${ctx.incoming.length} record(s)`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'transform',
    name: 'Transform',
    description: 'Remaps record fields. Define source→target mappings with optional transforms.',
    category: 'Process',
    icon: 'Shuffle',
    color: '#ec4899',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      mappings: jsonField('Field mappings', 'Array of { source, target, transform?, default? }. Empty = pass-through.', []),
    },
    help: 'Use this to rename fields, compute derived values (transform: "value * 2"), or build template strings (transform: "Hello {{value}}").',
  })

  registerNode(handler, descriptor)
}
