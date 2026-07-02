import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { findEmailForLead, runEmailFinderBatch } from '../../../backend/core/email-finder'
import { IdParamSchema, EmailFinderBatchSchema } from '../validation/schemas'

export const emailFinderRouter = new OpenAPIHono()

emailFinderRouter.openapi({
  method: 'post',
  path: '/lead/:id',
  summary: 'Find email for a single lead',
  tags: ['EmailFinder'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Found email', content: { 'application/json': { schema: z.object({ email: z.string().nullable() }) } } },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const email = await findEmailForLead(id)
  return c.json({ email })
})

emailFinderRouter.openapi({
  method: 'post',
  path: '/batch',
  summary: 'Find emails for multiple leads',
  tags: ['EmailFinder'],
  request: {
    body: { content: { 'application/json': { schema: EmailFinderBatchSchema } } },
  },
  responses: {
    200: { description: 'Batch started' },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  await runEmailFinderBatch(leadIds, (done, total, leadId) => {
    wsHub.broadcast('emailFinder:progress', { done, total, leadId })
  })
  return c.json({ success: true })
})
