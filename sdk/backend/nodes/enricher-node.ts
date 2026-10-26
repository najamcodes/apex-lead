// backend/nodes/enricher-node.ts
// Runs EnricherPlugins on records (PageSpeed, SSL, Hunter, AI decision-maker, etc.)

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, mainOutput, mainInput } from './descriptors'
import { runEnrichers, makeLeadSnapshot, getEnabledEnrichers } from '@sdk/core/plugins'
import type { NodeHandler } from '../engine/types'

export function registerEnricherNode() {
  const handler: NodeHandler = {
    type: 'enricher',
    async execute(ctx) {
      const selectedPlugins = (ctx.config.plugins as string[]) || []
      const exclude = (ctx.config.exclude as string[]) || []

      let effectiveExclude = [...exclude]
      if (selectedPlugins.length > 0) {
        try {
          const allEnricherIds = getEnabledEnrichers().map(r => r.manifest.id)
          const notSelected = allEnricherIds.filter(id => !selectedPlugins.includes(id))
          effectiveExclude = Array.from(new Set([...effectiveExclude, ...notSelected]))
        } catch {
          // If registry is not yet initialized, fall back to exclude
        }
      }

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()
        try {
          // Enrichers currently expect a LeadSnapshot. We treat any record as a snapshot.
          const snapshot = makeLeadSnapshot(rec.data)
          const enriched = await runEnrichers(snapshot, effectiveExclude)
          // Merge enriched fields back onto the record
          ctx.emit({ ...rec, data: { ...rec.data, ...enriched } })
        } catch (err) {
          ctx.log('error', `Enricher failed for ${rec.id}: ${err instanceof Error ? err.message : String(err)}`)
          ctx.emit(rec) // pass through on failure
        }
      }
      ctx.log('info', `Enriched ${ctx.incoming.length} record(s)`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'enricher',
    name: 'Enricher',
    description: 'Runs enricher plugins (PageSpeed, SSL check, email finder, etc.) to add fields to records.',
    category: 'Process',
    icon: 'PlusCircle',
    color: '#22c55e',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      plugins: selectField('Enrichers', [], 'Which enricher plugins to run. Populated dynamically. Empty = all enabled.'),
      exclude: selectField('Exclude', [], 'Enrichers to skip.'),
    },
    help: 'Enricher plugins add fields (e.g. pagespeed_mobile, email_verified, tech_stack) to each record. New fields are merged onto the output.',
  })

  registerNode(handler, descriptor)
}
