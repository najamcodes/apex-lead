// backend/core/pipelines/lead-pipeline.ts
import { insertLead } from '../../db/queries/leads.queries'
import { connectorHook } from '../outreach/connector-hook'
import { classifyWebsiteStatus } from '../scraper/classify-website'
import { Pipeline } from './base-pipeline'
import type { PipelineConfig, PipelineControlToken, PipelineProgressCallback } from './base-pipeline'
import { runExtraScrapers } from '../../../plugins/runner'
import { analyzeBatch } from '../analysis'
import { autoApproveLeads, autoScheduleSequences } from './helpers'

export class LeadGenerationPipeline extends Pipeline {
  id = 'lead-generation'
  name = 'Lead Generation'

  async execute(
    config: PipelineConfig,
    cancelToken: PipelineControlToken,
    onProgress: PipelineProgressCallback
  ): Promise<void> {
    const insertedIds: number[] = []
    let found = 0

    // STAGE 1: Scrape
    if (config.stages.scrape) {
      onProgress({
        job_id:           config.jobId,
        found:            0,
        total:            config.max_results,
        current_business: 'Starting scraping...',
        status:           'running',
      })

      const runConfig = {
        ...config,
        pluginConfig: {},
        isCancelled: () => cancelToken.cancelled,
        onProgress: (count: number, current: string) => {
          found = count
          onProgress({
            job_id:           config.jobId,
            found:            count,
            total:            config.max_results,
            current_business: current,
            status:           'running',
          })
        }
      }

      for await (const item of runExtraScrapers(runConfig)) {
        if (cancelToken.cancelled) break

        if (item.pipeline === 'lead') {
          const insertedId = await this.executeLeadSink(item.data)
          if (insertedId) insertedIds.push(insertedId)
        }
      }
    } else {
      // Future feature: If scrape is off, operate on existing leads. For now, do nothing.
      console.warn('Scraping stage disabled. Pipeline currently requires scraped leads to proceed.')
    }

    if (cancelToken.cancelled) return

    // STAGE 2: Analyze
    if (config.stages.analyze && insertedIds.length > 0) {
      onProgress({
        job_id:           config.jobId,
        found:            insertedIds.length,
        total:            insertedIds.length,
        current_business: 'Analyzing leads...',
        status:           'running',
      })

      await analyzeBatch(insertedIds, (done, total) => {
        onProgress({
          job_id:           config.jobId,
          found:            done,
          total,
          current_business: 'Analyzing...',
          status:           'running',
        })
      }).catch(() => {})

      if (config.settings?.auto_approve_threshold > 0) {
        onProgress({
          job_id:           config.jobId,
          found:            insertedIds.length,
          total:            insertedIds.length,
          current_business: 'Auto-approving leads...',
          status:           'running',
        })
        const promoted = await autoApproveLeads(config.settings.auto_approve_threshold)
        console.log(\[Pipeline] Auto-approved \ leads\)
      }
    }

    if (cancelToken.cancelled) return

    // STAGE 3: Outreach
    if (config.stages.outreach && config.settings?.auto_sequence_on_approve) {
      onProgress({
        job_id:           config.jobId,
        found:            insertedIds.length,
        total:            insertedIds.length,
        current_business: 'Scheduling sequences...',
        status:           'running',
      })
      await autoScheduleSequences((msg) => {
         onProgress({
            job_id:           config.jobId,
            found:            insertedIds.length,
            total:            insertedIds.length,
            current_business: msg,
            status:           'running',
          })
      })
    }
  }

  private async executeLeadSink(data: Record<string, unknown>): Promise<number | null> {
    try {
      const inserted = await insertLead({
        business_name:   data.business_name as string,
        category:        (data.category as string) || '',
        city:            (data.city as string) || '',
        country:         (data.country as string) || '',
        phone:           (data.phone as string) ?? null,
        website_url:     (data.website_url as string) ?? null,
        google_maps_url: (data.google_maps_url as string) ?? null,
        email:           (data.email as string) ?? null,
        website_status:  classifyWebsiteStatus(data.website_url as string) as any,
        ssl_valid:       null,
        tech_stack:      null,
        source:          (data.source as string) ?? 'unknown',
        review_rating:   (data.review_rating as number) ?? null,
        review_count:    (data.review_count as number) ?? null,
      })
      
      if (inserted?.id) {
        connectorHook.leadCreated(inserted.id).catch(() => {})
        return inserted.id
      }
    } catch {
      // duplicate or insert error
    }
    return null
  }
}
