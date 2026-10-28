import type { RequestContext } from 'katal';
import { wsHub } from '../../ws';
import { startPipelineJob, cancelPipelineJob, pausePipelineJob, resumePipelineJob } from '@sdk/core/pipelines';
import { getAllScrapeJobs, deleteScrapeJob, deleteScrapeJobs } from '../../db/queries/scrape-jobs.queries';
import { sendSuccess, sendError, HttpStatus } from '../../common';

export class ScraperController {
  /**
   * POST /api/scraper/jobs - Start a new scrape job
   */
  static async startJob(c: RequestContext): Promise<Response> {
    try {
      const config = c.req.valid ? c.req.valid('json') : await c.req.json();
      const jobId = await startPipelineJob('lead-generation', config, (event) => {
        wsHub.broadcast('scraper:progress', event);
      });
      return c.json(jobId, 201);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/scraper/jobs/:id/cancel
   */
  static async cancelJob(c: RequestContext): Promise<Response> {
    try {
      const id = (c.req.param('id') || '') as string;
      await cancelPipelineJob(id);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/scraper/jobs/:id/pause
   */
  static async pauseJob(c: RequestContext): Promise<Response> {
    try {
      const id = (c.req.param('id') || '') as string;
      await pausePipelineJob(id);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/scraper/jobs/:id/resume
   */
  static async resumeJob(c: RequestContext): Promise<Response> {
    try {
      const id = (c.req.param('id') || '') as string;
      await resumePipelineJob(id);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/scraper/jobs/:id
   */
  static async deleteJob(c: RequestContext): Promise<Response> {
    try {
      const id = (c.req.param('id') || '') as string;
      await deleteScrapeJob(id);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/scraper/jobs
   */
  static async deleteJobs(c: RequestContext): Promise<Response> {
    try {
      const { ids } = await c.req.json();
      await deleteScrapeJobs(ids);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/scraper/jobs
   */
  static async getAllJobs(c: RequestContext): Promise<Response> {
    try {
      const query = c.req.valid ? c.req.valid('query') : c.req.query();
      const result = await getAllScrapeJobs(query as unknown as import('@sdk/core/types').PaginationParams);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
