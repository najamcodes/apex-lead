// backend/nodes/store-node.ts
// Persists records into any named collection, or queries records from a collection.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, textField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerStoreNode() {
  const handler: NodeHandler = {
    type: 'store',
    async execute(ctx) {
      const mode = (ctx.config.mode as string) || 'upsert'
      const collection = (ctx.config.collection as string) || (ctx.incoming[0]?.collection) || 'records'

      if (!collection) {
        ctx.log('error', 'No collection specified for store node')
        return
      }

      if (mode === 'query') {
        // Query mode: read records from a collection and emit them
        await handleQueryMode(ctx, collection)
        return
      }

      // Write mode: store each incoming record
      const setStatus = ctx.config.set_status as string | undefined
      const { storeRecord } = await import('../collections/store')

      let stored = 0
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
          ctx.emit({ ...rec, data: { ...data, id: storedId, _stored: true }, collection })
          stored++
        } catch (err) {
          ctx.log('error', `Store failed for record ${rec.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      ctx.log('info', `Stored ${stored} record(s) into '${collection}'`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'store',
    name: 'Store / Query',
    description: 'Write records to any collection, or query records from a collection to use as pipeline data.',
    category: 'Storage',
    icon: 'Database',
    color: '#f59e0b',
    isStart: true,
    produces: true,
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      mode: selectField('Mode', ['upsert', 'insert', 'update', 'query'],
        'upsert: dedup on uniqueKey; insert: always create; update: modify existing; query: read records', 'upsert'),
      collection: strField('Collection', false, 'Collection name (e.g. leads, amazon_products, or any custom name).', 'records'),
      set_status: strField('Set status', false, 'Optionally set a "status" field on written records.'),
      query_filter: textField('Query filter (JS)', false, 'In query mode: JS expression to filter records. e.g. data.status === "approved"'),
      query_limit: strField('Query limit', false, 'In query mode: max records to return.', '100'),
    },
    help: 'Write modes:\n• upsert — deduplicates using the collection\'s uniqueKey fields\n• insert — always creates a new record\n• update — updates records matched by uniqueKey\n\nQuery mode: emits records FROM the collection downstream (turns this node into a data source).\nUse any collection name — it will be created automatically.',
  })

  registerNode(handler, descriptor)
}

async function handleQueryMode(
  ctx: import('../engine/types').NodeExecutionContext,
  collection: string,
): Promise<void> {
  try {
    const { getDataSource } = await import('../db')
    const { CollectionRecordEntity } = await import('../db/entities/CollectionRecordEntity')
    const repo = getDataSource().getRepository(CollectionRecordEntity)
    const limit = Math.min(Number(ctx.config.query_limit) || 100, 1000)
    const filterExpr = ctx.config.query_filter as string | undefined

    const rows = await repo.find({
      where: { collection, org_id: ctx.orgId },
      take: limit,
      order: { created_at: 'DESC' },
    })

    ctx.log('info', `Store query: found ${rows.length} records in '${collection}'`)
    let emitted = 0
    for (const row of rows) {
      if (ctx.isCancelled()) break
      let data: Record<string, unknown>
      try { data = JSON.parse(row.data) } catch { data = { _raw: row.data } }

      if (filterExpr) {
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('data', `'use strict'; return (${filterExpr})`)
          if (!fn(data)) continue
        } catch { /* include on error */ }
      }

      const rec: import('@sdk/core/types/pipeline.types').PipelineRecord = {
        id: row.id || import('crypto').then(c => c.randomUUID()) as unknown as string,
        collection,
        data,
        meta: {
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          sourceNodeId: ctx.nodeId,
          orgId: ctx.orgId,
          createdAt: row.created_at,
          trace: [ctx.nodeId],
        },
      }
      ctx.emit(rec as any)
      emitted++
    }
    ctx.log('info', `Store query: emitted ${emitted} records`)
  } catch (err) {
    ctx.log('error', `Store query failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
