// backend/nodes/scraper-node.ts
import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, numField, boolField, selectField, mainOutput, mainInput } from './descriptors'
import { getEnabledScrapers, getAllPlugins } from '../../plugins/registry'
import type { ScraperPlugin } from '../../plugins/types'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord, ScrapedItem } from '../../shared/types/pipeline.types'

export function registerScraperNode() {
  const handler: NodeHandler = {
    type: 'scraper',
    async execute(ctx) {
      const pluginId = ctx.config.plugin as string
      if (!pluginId) {
        ctx.log('error', 'No scraper plugin selected')
        return
      }

      const records = getEnabledScrapers()
      const record = records.find(r => r.manifest.id === pluginId)
      if (!record || !record.enabled) {
        ctx.log('error', `Scraper plugin '${pluginId}' not enabled or not found`)
        return
      }

      // Scraper plugins may be disabled in registry but explicitly selected here.
      const allRecords = getAllPlugins()
      const fullRecord = allRecords.find(r => r.manifest.id === pluginId)
      if (!fullRecord) {
        ctx.log('error', `Scraper plugin '${pluginId}' not registered`)
        return
      }

      const plugin = fullRecord.plugin as ScraperPlugin

      const runConfig = {
        query: (ctx.config.query as string) || (ctx.input.query as string) || '',
        city: (ctx.config.city as string) || (ctx.input.city as string) || '',
        country: (ctx.config.country as string) || (ctx.input.country as string) || 'United States',
        max_results: (ctx.config.max_results as number) || 100,
        use_proxy: (ctx.config.use_proxy as boolean) || false,
        pluginConfig: fullRecord.config,
        onProgress: (found: number, current: string) => {
          ctx.log('info', `Scraping: ${found} found — ${current}`)
        },
        isCancelled: ctx.isCancelled,
      }

      if (!runConfig.query) {
        ctx.log('error', 'No query provided to scraper')
        return
      }

      ctx.log('info', `Starting scraper '${pluginId}' for: ${runConfig.query} in ${runConfig.city}`)
      let count = 0
      try {
        for await (const item of plugin.scrape(runConfig)) {
          if (ctx.isCancelled()) break
          await ctx.isPaused()
          const rec = scrapedItemToRecord(item, ctx)
          ctx.emit(rec)
          count++
        }
        ctx.log('info', `Scraper finished: ${count} records produced`)
      } catch (err) {
        ctx.log('error', `Scraper failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'scraper',
    name: 'Scraper',
    description: 'Produces records from an external data source using a ScraperPlugin (Google Maps, Amazon, etc.).',
    category: 'Source',
    icon: 'Download',
    color: '#3b82f6',
    isStart: true,
    produces: true,
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      plugin: selectField('Scraper plugin', [], 'Which installed scraper to use. Populated dynamically.'),
      query: strField('Query', false, 'Search query, e.g. "restaurants".'),
      city: strField('City', false),
      country: strField('Country', false, undefined, 'United States'),
      max_results: numField('Max results', false, 'Maximum records to scrape.', 100),
      use_proxy: boolField('Use proxy', 'Route through a rotating proxy.'),
    },
    help: 'Select a scraper plugin and provide search parameters. Records flow out the main port.',
  })

  registerNode(handler, descriptor)
}

function scrapedItemToRecord(item: ScrapedItem, ctx: { runId: string; pipelineId: string; orgId: number; nodeId: string }): PipelineRecord {
  return {
    id: randomUUID(),
    collection: item.pipeline === 'lead' ? 'leads' : item.pipeline,
    data: item.data,
    meta: {
      pipelineId: ctx.pipelineId,
      runId: ctx.runId,
      sourceNodeId: ctx.nodeId,
      orgId: ctx.orgId,
      createdAt: new Date().toISOString(),
      trace: [ctx.nodeId],
    },
  }
}
