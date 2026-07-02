import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { scoreSite } from '../../../backend/core/ai/tasks/score-site'
import { draftOutreach } from '../../../backend/core/ai/tasks/draft-outreach'
import { getSettings } from '../../../backend/db/queries/settings.queries'
import { AIScoreSchema, AIDraftSchema } from '../validation/schemas'

export const aiRouter = new OpenAPIHono()

aiRouter.openapi({
  method: 'post',
  path: '/score-site',
  summary: 'Score a lead site using AI',
  tags: ['AI'],
  request: {
    body: { content: { 'application/json': { schema: AIScoreSchema } } },
  },
  responses: {
    200: { description: 'Site scored', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request' },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const { leadId, model } = c.req.valid('json')
  const settings = await getSettings()
  const result = await scoreSite(settings, leadId, model)
  return c.json(result)
})

aiRouter.openapi({
  method: 'post',
  path: '/draft-email',
  summary: 'Draft outreach email using AI',
  tags: ['AI'],
  request: {
    body: { content: { 'application/json': { schema: AIDraftSchema } } },
  },
  responses: {
    200: { description: 'Email drafted', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request' },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const { leadId, model } = c.req.valid('json')
  const settings = await getSettings()
  const result = await draftOutreach(settings, leadId, settings.developer_name ?? 'Your Name', model)
  return c.json(result)
})