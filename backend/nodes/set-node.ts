// backend/nodes/set-node.ts
// Sets static or expression-derived fields on every incoming record (or creates a seed record with no input).

import { registerNode } from '../engine/registry'
import { makeDescriptor, jsonField, mainOutput, mainInput } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

interface SetField {
  name: string
  value: unknown
  /** Optional JS expression evaluated against `record` and `input`. */
  expression?: string
}

export function registerSetNode() {
  const handler: NodeHandler = {
    type: 'set',
    async execute(ctx) {
      const fields: SetField[] = Array.isArray(ctx.config.fields) ? (ctx.config.fields as SetField[]) : []
      const keepExisting = ctx.config.keep_existing !== false // default true

      const applyFields = (base: Record<string, unknown>): Record<string, unknown> => {
        const result = keepExisting ? { ...base } : {}
        for (const f of fields) {
          if (!f.name) continue
          if (f.expression) {
            try {
              // eslint-disable-next-line no-new-func
              const fn = new Function('record', 'input', `'use strict'; return (${f.expression})`)
              result[f.name] = fn(base, ctx.input)
            } catch {
              result[f.name] = f.value ?? null
            }
          } else {
            result[f.name] = f.value ?? null
          }
        }
        return result
      }

      if (ctx.incoming.length === 0) {
        // Source mode: no upstream — produce a single seed record
        const data = applyFields(typeof ctx.input === 'object' ? ctx.input : {})
        const seed: PipelineRecord = {
          id: randomUUID(),
          collection: (ctx.config.collection as string) || 'data',
          data,
          meta: {
            pipelineId: ctx.pipelineId,
            runId: ctx.runId,
            sourceNodeId: ctx.nodeId,
            orgId: ctx.orgId,
            createdAt: new Date().toISOString(),
            trace: [ctx.nodeId],
          },
        }
        ctx.emit(seed)
        ctx.log('info', 'Set node produced 1 seed record')
        return
      }

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()
        const data = applyFields(rec.data)
        ctx.emit({ ...rec, data })
      }
      ctx.log('info', `Set fields on ${ctx.incoming.length} record(s)`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'set',
    name: 'Set',
    description: 'Set static values or computed expressions on record fields. Can also create a seed record with no upstream input.',
    category: 'Transform',
    icon: 'PenSquare',
    color: '#0ea5e9',
    isStart: true,
    produces: true,
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      fields: jsonField(
        'Fields',
        'Array of { name, value, expression? }. If expression is set, it is evaluated as JS against `record` and `input`.',
        [{ name: 'my_field', value: 'hello world' }]
      ),
      keep_existing: { type: 'boolean', label: 'Keep existing fields', default: true },
      collection: { type: 'string', label: 'Collection (seed mode)', default: 'data', description: 'Used when there is no upstream input.' },
    },
    help: 'Examples:\n{ "name": "status", "value": "pending" }\n{ "name": "full_name", "expression": "record.first_name + \" \" + record.last_name" }',
  })

  registerNode(handler, descriptor)
}
