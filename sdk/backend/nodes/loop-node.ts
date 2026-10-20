// backend/nodes/loop-node.ts
// Iterates over an array field on each record, emitting one record per element.

import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, mainOutput, mainInput } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerLoopNode() {
  const handler: NodeHandler = {
    type: 'loop',
    async execute(ctx) {
      const field = (ctx.config.field as string) || 'items'
      const asName = (ctx.config.as as string) || 'item'
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        const arr = rec.data[field]
        if (!Array.isArray(arr)) {
          ctx.emit(rec)
          continue
        }
        for (const item of arr) {
          const child: PipelineRecord = {
            ...rec,
            id: randomUUID(),
            data: { ...rec.data, [asName]: item, _index: arr.indexOf(item) },
            meta: { ...rec.meta, sourceNodeId: ctx.nodeId, trace: [...rec.meta.trace, ctx.nodeId] },
          }
          ctx.emit(child)
        }
      }
      ctx.log('info', `Loop expanded ${ctx.incoming.length} record(s)`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'loop',
    name: 'Loop (Split)',
    description: 'Splits an array field into individual records (one output per element).',
    category: 'Logic',
    icon: 'Repeat',
    color: '#0ea5e9',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      field: strField('Array field', true, 'Name of the array field to iterate over.', 'items'),
      as: strField('Element name', false, 'Name to give each element on the output record.', 'item'),
    },
  })

  registerNode(handler, descriptor)
}
