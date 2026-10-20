import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { analyzeLead, analyzeBatch } from '@sdk/core/analysis'
import { AnalysisRunSchema } from '../validation/schemas'

export const analysisRouter = new OpenAPIHono()

analysisRouter.openapi({
  method: 'post',
  path: '/lead/:id',
  summary: 'Analyze a single lead',
  tags: ['Analysis'],
  request: {
    params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }),
  },
  responses: {
    200: { description: 'Analysis result', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const id = c.req.valid('param').id
  const result = await analyzeLead(id)
  return c.json(result)
})

analysisRouter.openapi({
  method: 'post',
  path: '/batch',
  summary: 'Analyze multiple leads',
  tags: ['Analysis'],
  request: {
    body: { content: { 'application/json': { schema: AnalysisRunSchema } } },
  },
  responses: {
    200: { description: 'Batch analysis started', content: { 'application/json': { schema: z.object({ success: z.boolean() }) } } },
    400: { description: 'Invalid request' },
  },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  await analyzeBatch(leadIds, (done, total, leadId) => {
    wsHub.broadcast('analysis:progress', { done, total, leadId })
  })
  return c.json({ success: true })
})