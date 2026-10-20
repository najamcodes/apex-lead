// backend/nodes/aggregate-node.ts
// Collects ALL incoming records and produces a single summarised record.
// Like n8n's "Summarize" node.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, mainOutput, mainInput } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerAggregateNode() {
  const handler: NodeHandler = {
    type: 'aggregate',
    async execute(ctx) {
      const mode = (ctx.config.mode as string) || 'collect'
      const field = ctx.config.field as string | undefined
      const outputField = (ctx.config.output_field as string) || 'result'
      const records = ctx.incoming

      if (records.length === 0) {
        ctx.log('warn', 'Aggregate received 0 records — nothing to aggregate')
        return
      }

      let result: unknown

      switch (mode) {
        case 'count':
          result = records.length
          break

        case 'sum': {
          if (!field) { ctx.log('error', 'Aggregate sum requires a field'); return }
          result = records.reduce((acc, r) => acc + (Number(r.data[field]) || 0), 0)
          break
        }

        case 'avg': {
          if (!field) { ctx.log('error', 'Aggregate avg requires a field'); return }
          const sum = records.reduce((acc, r) => acc + (Number(r.data[field]) || 0), 0)
          result = sum / records.length
          break
        }

        case 'min': {
          if (!field) { ctx.log('error', 'Aggregate min requires a field'); return }
          result = Math.min(...records.map(r => Number(r.data[field]) || 0))
          break
        }

        case 'max': {
          if (!field) { ctx.log('error', 'Aggregate max requires a field'); return }
          result = Math.max(...records.map(r => Number(r.data[field]) || 0))
          break
        }

        case 'collect':
          result = records.map(r => r.data)
          break

        case 'first':
          result = records[0].data
          break

        case 'last':
          result = records[records.length - 1].data
          break

        case 'join': {
          const sep = (ctx.config.separator as string) || ', '
          if (!field) { ctx.log('error', 'Aggregate join requires a field'); return }
          result = records.map(r => String(r.data[field] ?? '')).join(sep)
          break
        }

        default:
          result = records.map(r => r.data)
      }

      const summary: PipelineRecord = {
        id: randomUUID(),
        collection: records[0].collection,
        data: {
          [outputField]: result,
          _count: records.length,
          _mode: mode,
          _field: field,
        },
        meta: {
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          sourceNodeId: ctx.nodeId,
          orgId: ctx.orgId,
          createdAt: new Date().toISOString(),
          trace: [...(records[0].meta.trace ?? []), ctx.nodeId],
        },
      }

      ctx.emit(summary)
      ctx.log('info', `Aggregated ${records.length} records → ${mode}${field ? ` on '${field}'` : ''}`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'aggregate',
    name: 'Aggregate',
    description: 'Collect all incoming records and produce a single summary record (count, sum, avg, min, max, collect, join).',
    category: 'Transform',
    icon: 'Sigma',
    color: '#f59e0b',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      mode: selectField(
        'Mode',
        ['collect', 'count', 'sum', 'avg', 'min', 'max', 'first', 'last', 'join'],
        'How to aggregate. collect = array of all records.',
        'collect'
      ),
      field: strField('Field name', false, 'Required for sum/avg/min/max/join. The field to aggregate on.'),
      output_field: strField('Output field', false, 'Where to store the result.', 'result'),
      separator: strField('Separator', false, 'For join mode only.', ', '),
    },
    help: 'Aggregate waits for ALL upstream records before running. Use it after a scraper or loop to get totals, lists, or summaries.\n\nExamples:\n- count: total records received\n- sum on "price": total of all prices\n- collect: array of all record data objects\n- join on "name": comma-separated names',
  })

  registerNode(handler, descriptor)
}
