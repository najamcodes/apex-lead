import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { startPipelineJob, cancelPipelineJob, pausePipelineJob, resumePipelineJob } from '@sdk/core/pipelines'
import { getAllScrapeJobs, deleteScrapeJob, deleteScrapeJobs } from '@sdk/backend/db/queries/scrape-jobs.queries'
import { ScraperStartSchema, ScraperJobQuerySchema } from '../validation/schemas'

export const scraperRouter = new OpenAPIHono()

// POST /api/scraper/jobs - Start a new scrape job
scraperRouter.openapi({
  method: 'post',
  path: '/jobs',
  summary: 'Start a new scrape job',
  tags: ['Scraper'],
  request: {
    body: { content: { 'application/json': { schema: ScraperStartSchema } } },
  },
  responses: {
    201: { description: 'Job started', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const config = c.req.valid('json')
  const jobId = await startPipelineJob('lead-generation', config, (event) => {
    wsHub.broadcast('scraper:progress', event)
  })
  return c.json(jobId, 201)
})

// POST /api/scraper/jobs/:id/cancel - Cancel a scrape job
scraperRouter.openapi({
  method: 'post',
  path: '/jobs/:id/cancel',
  summary: 'Cancel a scrape job',
  tags: ['Scraper'],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Job cancelled' },
  },
}, async (c) => {
  const id = c.req.param('id') as string
  await cancelPipelineJob(id)
  return c.json({ success: true })
})

// POST /api/scraper/jobs/:id/pause - Pause a scrape job
scraperRouter.openapi({
  method: 'post',
  path: '/jobs/:id/pause',
  summary: 'Pause a scrape job',
  tags: ['Scraper'],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Job paused' },
  },
}, async (c) => {
  const id = c.req.param('id') as string
  await pausePipelineJob(id)
  return c.json({ success: true })
})

// POST /api/scraper/jobs/:id/resume - Resume a scrape job
scraperRouter.openapi({
  method: 'post',
  path: '/jobs/:id/resume',
  summary: 'Resume a scrape job',
  tags: ['Scraper'],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Job resumed' },
  },
}, async (c) => {
  const id = c.req.param('id')!
  await resumePipelineJob(id)
  return c.json({ success: true })
})

// DELETE /api/scraper/jobs/:id - Delete a scrape job
scraperRouter.openapi({
  method: 'delete',
  path: '/jobs/:id',
  summary: 'Delete a scrape job',
  tags: ['Scraper'],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Job deleted' },
  },
}, async (c) => {
  const id = c.req.param('id')!
  await deleteScrapeJob(id)
  return c.json({ success: true })
})

// DELETE /api/scraper/jobs - Delete multiple scrape jobs
scraperRouter.openapi({
  method: 'delete',
  path: '/jobs',
  summary: 'Delete multiple scrape jobs',
  tags: ['Scraper'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.string()) }) } } },
  },
  responses: {
    200: { description: 'Jobs deleted' },
  },
}, async (c) => {
  const { ids } = await c.req.json()
  await deleteScrapeJobs(ids)
  return c.json({ success: true })
})

// GET /api/scraper/jobs - Get all scrape jobs
scraperRouter.openapi({
  method: 'get',
  path: '/jobs',
  summary: 'Get all scrape jobs',
  tags: ['Scraper'],
  request: { query: ScraperJobQuerySchema },
  responses: {
    200: { description: 'List of scrape jobs', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const query = c.req.valid('query')
  const result = await getAllScrapeJobs(query as any)
  return c.json(result)
})
