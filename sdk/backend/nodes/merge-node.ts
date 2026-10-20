// backend/nodes/merge-node.ts
// Joins multiple input streams into one. Buffers until all upstreams are done.

import { registerNode } from '../engine/registry'
import { makeDescriptor, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerMergeNode() {
  const handler: NodeHandler = {
    type: 'merge',
    async execute(ctx) {
      // The engine already gathers all incoming records before running a node,
      // so merge is a simple pass-through that flattens multiple inputs.
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        ctx.emit(rec)
      }
      ctx.log('info', `Merged ${ctx.incoming.length} record(s)`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'merge',
    name: 'Merge',
    description: 'Combines records from multiple input streams into one output.',
    category: 'Logic',
    icon: 'GitMerge',
    color: '#14b8a6',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {},
    help: 'Connect multiple upstream nodes to this node. All records are merged and emitted on the single output.',
  })

  registerNode(handler, descriptor)
}
