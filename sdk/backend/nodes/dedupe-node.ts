// sdk/backend/nodes/dedupe-node.ts
// Deduplicates incoming pipeline records by unique field or normalized fuzzy keys.

import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, selectField, boolField, mainOutput, mainInput, anySchema, getPath } from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

function normalizeValue(val: unknown, fuzzy: boolean): string {
  if (val === null || val === undefined) return ''
  let str = String(val).trim().toLowerCase()

  if (fuzzy) {
    // Strip http/https/www protocols and trailing slashes for URLs/domains
    str = str.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
    // Strip common company legal endings (inc, llc, corp, ltd)
    str = str.replace(/\b(inc|llc|corp|corporation|ltd|limited|gmbh)\b/gi, '').trim()
    // Collapse multiple whitespace
    str = str.replace(/\s+/g, ' ')
  }

  return str
}

export function registerDedupeNode() {
  const handler: NodeHandler = {
    type: 'dedupe' as any,
    async execute(ctx) {
      const field = (ctx.config.field as string) || 'email'
      const fuzzy = Boolean(ctx.config.fuzzy)
      const action = (ctx.config.action as string) || 'drop'

      const seenKeys = new Set<string>()
      const uniqueRecords: PipelineRecord[] = []
      const duplicateRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const rawVal = getPath(field, rec.data || {})
        const normKey = normalizeValue(rawVal, fuzzy)

        if (!normKey || seenKeys.has(normKey)) {
          duplicateRecords.push(rec)
        } else {
          seenKeys.add(normKey)
          uniqueRecords.push(rec)
        }
      }

      ctx.log('info', `[DedupeNode] Processed ${ctx.incoming.length} records. Unique: ${uniqueRecords.length}, Duplicates: ${duplicateRecords.length}`)

      // Emit unique records on 'main' port
      ctx.emit(uniqueRecords, 'main')

      // If branching duplicates, emit on 'duplicate' port
      if (action === 'branch' && duplicateRecords.length > 0) {
        ctx.emit(duplicateRecords, 'duplicate')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'dedupe' as any,
    name: 'Deduplicate',
    description: 'Deduplicates records based on a specific field (e.g. email, domain) with optional fuzzy normalization.',
    category: 'Logic',
    icon: 'CopyCheck',
    color: '#8B5CF6',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'duplicate', label: 'Duplicates', schema: anySchema },
    ],
    configSchema: {
      field: strField('Unique Field Key', true, 'Property to deduplicate by (e.g. email, website, companyName)', 'email'),
      fuzzy: boolField('Fuzzy Match Normalization', 'Strip protocols, www, legal suffixes, and spaces before checking', true),
      action: selectField('Duplicate Handling', ['drop', 'branch'], 'Drop duplicates or route them to the "duplicate" port', 'drop'),
    },
  })

  registerNode(handler, descriptor)
}
