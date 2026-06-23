// backend/core/pipelines/runner.ts
import { randomUUID as uuid } from 'crypto'
import { insertScrapeJob, updateScrapeJob } from '../../db/queries/scrape-jobs.queries'
import { LeadGenerationPipeline } from './lead-pipeline'
import type { PipelineConfig, PipelineControlToken, PipelineProgressCallback, Pipeline } from './base-pipeline'
import type { ScrapeJobConfig, ScrapeProgressEvent } from '../../../shared/types/scraper.types'
import { getSettings } from '../../db/queries/settings.queries'

const activeJobs = new Map<string, PipelineControlToken>()

// Registry of available pipelines
const pipelines = new Map<string, Pipeline>()
const leadPipeline = new LeadGenerationPipeline()
pipelines.set(leadPipeline.id, leadPipeline)

export async function checkPause(token: PipelineControlToken) {
  while (token.paused && !token.cancelled) {
    await new Promise(r => setTimeout(r, 1000))
  }
}

export async function startPipelineJob(
  pipelineId: string,
  config: ScrapeJobConfig & { stages?: any },
  onProgress: PipelineProgressCallback
): Promise<string> {
  const pipeline = pipelines.get(pipelineId)
  if (!pipeline) {
    throw new Error(\Pipeline not found: \\)
  }

  const jobId = uuid()
  const cancelToken: PipelineControlToken = { cancelled: false, paused: false }
  activeJobs.set(jobId, cancelToken)

  insertScrapeJob({
    id:          jobId,
    query:       config.query,
    city:        config.city,
    country:     config.country,
    max_results: config.max_results,
    status:      'running',
  })

  updateScrapeJob(jobId, {
    started_at: new Date().toISOString(),
    status:     'running',
  })

  ;(async () => {
    try {
      const settings = await getSettings()
      
      const pipelineConfig: PipelineConfig = {
        ...config,
        jobId,
        stages: config.stages ?? {
          scrape: true,
          analyze: settings.ai_enabled,
          outreach: false,
        },
        use_proxy: settings.proxy_enabled,
        settings, // pass settings so pipeline doesn't have to fetch again
      }

      await pipeline.execute(pipelineConfig, cancelToken, onProgress)

      const finalStatus = cancelToken.cancelled ? 'cancelled' : 'completed'
      
      updateScrapeJob(jobId, {
        status:       finalStatus,
        progress:     100,
        completed_at: new Date().toISOString(),
      })

    } catch (err) {
      console.error('[PipelineRunner] Job failed:', err)
      updateScrapeJob(jobId, {
        status:        'failed',
        error_message: String(err),
        completed_at:  new Date().toISOString(),
      })
      onProgress({
        job_id:           jobId,
        found:            0,
        total:            config.max_results,
        current_business: '',
        status:           'failed',
        error:            String(err),
      })
    } finally {
      activeJobs.delete(jobId)
    }
  })()

  return jobId
}

export function cancelPipelineJob(jobId: string): void {
  const token = activeJobs.get(jobId)
  if (token) {
    token.cancelled = true
    updateScrapeJob(jobId, {
      status:       'cancelled',
      completed_at: new Date().toISOString(),
    })
  }
}

export function pausePipelineJob(jobId: string): void {
  const token = activeJobs.get(jobId)
  if (token) {
    token.paused = true
    updateScrapeJob(jobId, { status: 'paused' })
  }
}

export function resumePipelineJob(jobId: string): void {
  const token = activeJobs.get(jobId)
  if (token) {
    token.paused = false
    updateScrapeJob(jobId, { status: 'running' })
  }
}
