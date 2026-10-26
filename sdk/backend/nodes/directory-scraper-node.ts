// sdk/backend/nodes/directory-scraper-node.ts
// Direct source node for scraping business directories (YellowPages, Clutch, Contractor Estimator, ThomasNet, Crunchbase, G2).

import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, numField, boolField, selectField, mainOutput, mainInput } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { scrapeYellowPages } from '../../../plugins/built-in/scraper-yellowpages/yellowpages'
import { scrapeClutch } from '../../../plugins/built-in/scraper-clutch/clutch'
import { scrapeContractors } from '../../../plugins/built-in/scraper-contractor-estimator/contractor-estimator'
import { scrapeThomasNet } from '../../../plugins/built-in/scraper-thomasnet/thomasnet'
import { scrapeCrunchbase } from '../../../plugins/built-in/scraper-crunchbase/crunchbase'
import { scrapeG2 } from '../../../plugins/built-in/scraper-g2/g2'

export function registerDirectoryScraperNode() {
  const handler: NodeHandler = {
    type: 'directory_scraper',
    async execute(ctx) {
      const directory = (ctx.config.directory as string) || 'yellowpages'
      const category = (ctx.config.category as string) || (ctx.input.category as string) || (ctx.input.query as string) || 'General'
      const city = (ctx.config.city as string) || (ctx.input.city as string) || ''
      const country = (ctx.config.country as string) || (ctx.input.country as string) || 'United States'
      const maxResults = Number(ctx.config.max_results) || 50
      const isSimulate = Boolean(ctx.config.simulate)

      ctx.log('info', `Starting directory scraper for [${directory}] category="${category}" in "${city}" (max: ${maxResults})`)

      const cancelToken = {
        get cancelled() { return ctx.isCancelled ? ctx.isCancelled() : false },
        paused: false,
      }

      let rawItems: any[] = []

      let context: any = null
      if (!isSimulate) {
        try {
          const { createStealthContext } = await import('@sdk/core/scraper/stealth')
          const stealth = await createStealthContext(null, true)
          context = stealth.context
        } catch {
          context = null
        }
      }

      const simulateMode = isSimulate || !context

      try {
        if (directory === 'clutch') {
          rawItems = await scrapeClutch(
            context,
            category,
            city,
            maxResults,
            (found, current) => {
              ctx.log('info', `Clutch: scraped ${found} — ${current}`)
            },
            cancelToken,
            simulateMode
          )
        } else if (directory === 'contractor_estimator') {
          rawItems = await scrapeContractors(
            context,
            category,
            city,
            maxResults,
            (found, current) => {
              ctx.log('info', `Contractor Estimator: scraped ${found} — ${current}`)
            },
            cancelToken,
            simulateMode
          )
        } else if (directory === 'thomasnet') {
          rawItems = await scrapeThomasNet(
            context,
            category,
            city,
            maxResults,
            (found, current) => {
              ctx.log('info', `ThomasNet: scraped ${found} — ${current}`)
            },
            cancelToken,
            simulateMode
          )
        } else if (directory === 'crunchbase') {
          rawItems = await scrapeCrunchbase(
            context,
            category,
            city,
            maxResults,
            (found, current) => {
              ctx.log('info', `Crunchbase: scraped ${found} — ${current}`)
            },
            cancelToken,
            simulateMode
          )
        } else if (directory === 'g2') {
          rawItems = await scrapeG2(
            context,
            category,
            city,
            maxResults,
            (found, current) => {
              ctx.log('info', `G2: scraped ${found} — ${current}`)
            },
            cancelToken,
            simulateMode
          )
        } else {
          // YellowPages default
          rawItems = await scrapeYellowPages(
            context,
            category,
            city,
            maxResults,
            (found, current) => {
              ctx.log('info', `YellowPages: scraped ${found} — ${current}`)
            },
            cancelToken,
            simulateMode
          )
        }

        let count = 0
        for (const item of rawItems) {
          if (ctx.isCancelled()) break
          await ctx.isPaused()

          const record: PipelineRecord = {
            id: randomUUID(),
            collection: 'leads',
            data: {
              ...item,
              category: item.category || category,
              city: item.city || city,
              country: item.country || country,
              source: item.source || directory,
              scraped_at: new Date().toISOString(),
            },
            meta: {
              pipelineId: ctx.pipelineId,
              runId: ctx.runId,
              sourceNodeId: ctx.nodeId,
              orgId: ctx.orgId,
              createdAt: new Date().toISOString(),
              trace: [ctx.nodeId],
            },
          }

          ctx.emit(record)
          count++
        }

        ctx.log('info', `Directory scraper finished: produced ${count} records from ${directory}`)
      } catch (err: any) {
        ctx.log('error', `Directory scraper failed: ${err?.message || err}`)
      } finally {
        if (context) {
          await context.close().catch(() => {})
        }
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'directory_scraper',
    name: 'Directory & Trade Scraper',
    description: 'Extracts leads and listings directly from business directories (YellowPages, Clutch, Contractor Estimator, ThomasNet, Crunchbase, G2).',
    category: 'Source',
    icon: 'Compass',
    color: '#8b5cf6',
    isStart: true,
    produces: true,
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      directory: selectField(
        'Directory Platform',
        ['yellowpages', 'clutch', 'contractor_estimator', 'thomasnet', 'crunchbase', 'g2'],
        'Directory platform to harvest leads from',
        'yellowpages'
      ),
      category: strField('Category / Trade', true, 'e.g. Roofing, Custom Software Development, CNC Machining, B2B SaaS', 'Roofing'),
      city: strField('City / Region', false, 'e.g. Austin, TX, Chicago, IL, San Francisco, CA', 'Dallas, TX'),
      country: strField('Country', false, undefined, 'United States'),
      max_results: numField('Max Results', false, 'Maximum records to scrape', 50),
      simulate: boolField('Simulate / Mock Mode', 'Fast offline simulated data generation for testing/preview', true),
    },
    help: 'Extracts business records from directory platforms. Generates pipeline records with rich contact, cost, and reputation metadata.',
  })

  registerNode(handler, descriptor)
}
