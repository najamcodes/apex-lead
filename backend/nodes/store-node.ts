// backend/nodes/store-node.ts
// Persists records into a collection (generic table).

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, boolField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

export function registerStoreNode() {
  const handler: NodeHandler = {
    type: 'store',
    async execute(ctx) {
      const collection = (ctx.config.collection as string) || (ctx.incoming[0]?.collection)
      const mode = (ctx.config.mode as string) || 'upsert'
      const setStatus = ctx.config.set_status as string | undefined

      if (!collection) {
        ctx.log('error', 'No collection specified for store node')
        return
      }

      // Lazy import to avoid circular deps at module load
      const { storeRecord } = await import('../collections/store')

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()
        try {
          let data = { ...rec.data }
          if (setStatus) data.status = setStatus
          const storedId = await storeRecord({
            collection,
            orgId: ctx.orgId,
            data,
            mode: mode as 'upsert' | 'insert' | 'update',
            source: `${ctx.pipelineId}:${ctx.nodeId}`,
          })
          // Emit the record with the stored id attached
          ctx.emit({ ...rec, data: { ...data, id: storedId, _stored: true } })
        } catch (err) {
          ctx.log('error', `Store failed for record ${rec.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      ctx.log('info', `Stored ${ctx.incoming.length} record(s) into '${collection}'`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'store',
    name: 'Store',
    description: 'Persists records into a collection (table). Supports upsert, insert, and update modes.',
    category: 'Storage',
    icon: 'Database',
    color: '#f59e0b',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      collection: selectField('Collection', [], 'Which collection to write to. Populated dynamically.'),
      mode: selectField('Mode', ['upsert', 'insert', 'update'], 'upsert dedupes on unique key; insert always creates; update requires existing.'),
      set_status: strField('Set status', false, 'Optional: set a status field on stored records.'),
    },
    help: 'Records are written to the selected collection. Use upsert to avoid duplicates (requires the collection to have a uniqueKey field).',
  })

  registerNode(handler, descriptor)
}
