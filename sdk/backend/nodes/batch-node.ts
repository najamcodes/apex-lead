// sdk/backend/nodes/batch-node.ts
// Partitions incoming records into rate-limited batches to prevent API quota exhaustion.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  numField,
  boolField,
  mainOutput,
  mainInput,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerBatchNode() {
  const handler: NodeHandler = {
    type: 'batch' as any,
    async execute(ctx) {
      const batchSize = Math.max(1, Number(ctx.config.batchSize ?? 10))
      const delayMs = Math.max(0, Number(ctx.config.delayBetweenBatchesMs ?? 100))
      const tagBatches = ctx.config.tagBatches !== false

      const totalRecords = ctx.incoming.length
      const batches: PipelineRecord[][] = []

      for (let i = 0; i < totalRecords; i += batchSize) {
        batches.push(ctx.incoming.slice(i, i + batchSize))
      }

      ctx.log(
        'info',
        `[BatchNode] Partitioned ${totalRecords} records into ${batches.length} batches of size ${batchSize}.`
      )

      const outputRecords: PipelineRecord[] = []

      for (let bIndex = 0; bIndex < batches.length; bIndex++) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const currentBatch = batches[bIndex]

        for (let itemIdx = 0; itemIdx < currentBatch.length; itemIdx++) {
          const rec = currentBatch[itemIdx]
          const updatedRec: PipelineRecord = {
            ...rec,
            data: tagBatches
              ? {
                  ...rec.data,
                  batchIndex: bIndex + 1,
                  totalBatches: batches.length,
                  batchSize,
                  indexInBatch: itemIdx + 1,
                }
              : rec.data,
            meta: {
              ...rec.meta,
              sourceNodeId: ctx.nodeId,
              trace: [...(rec.meta.trace || []), ctx.nodeId],
            },
          }
          outputRecords.push(updatedRec)
        }

        // Apply throttle delay between batches if not the last batch
        if (bIndex < batches.length - 1 && delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5000)))
        }
      }

      ctx.emit(outputRecords, 'main')
    },
  }

  const descriptor = makeDescriptor({
    type: 'batch' as any,
    name: 'Batch & Throttler',
    description: 'Partitions large record streams into rate-limited batches to prevent API quota overages.',
    category: 'Logic',
    icon: 'Boxes',
    color: '#6366F1',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      batchSize: numField('Batch Size', false, 'Number of records per chunk/batch', 10),
      delayBetweenBatchesMs: numField('Delay Between Batches (ms)', false, 'Delay in milliseconds between chunk releases', 100),
      tagBatches: boolField('Tag Batch Metadata', 'Add batchIndex and totalBatches properties to record data', true),
    },
  })

  registerNode(handler, descriptor)
}
