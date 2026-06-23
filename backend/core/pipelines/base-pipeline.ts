// backend/core/pipelines/base-pipeline.ts
import type { ScrapeProgressEvent } from '../../../shared/types/scraper.types'

export interface PipelineStages {
  scrape: boolean
  analyze: boolean
  outreach: boolean
  [key: string]: boolean
}

export interface PipelineConfig {
  jobId: string
  query: string
  city: string
  country: string
  max_results: number
  stages: PipelineStages
  [key: string]: any
}

export interface PipelineControlToken {
  cancelled: boolean
  paused: boolean
}

export type PipelineProgressCallback = (event: ScrapeProgressEvent) => void

export abstract class Pipeline {
  abstract id: string
  abstract name: string

  /**
   * Executes the pipeline.
   * @param config The configuration for this run (including stage toggles)
   * @param cancelToken Token to check for cancellation
   * @param onProgress Callback to report progress
   */
  abstract execute(
    config: PipelineConfig,
    cancelToken: PipelineControlToken,
    onProgress: PipelineProgressCallback
  ): Promise<void>
}
