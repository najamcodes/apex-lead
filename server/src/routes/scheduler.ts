import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

export const schedulerRouter = new OpenAPIHono()

schedulerRouter.openapi({
  method: 'get',
  path: '/status',
  summary: 'Get scheduler status',
  tags: ['Scheduler'],
  responses: {
    200: { description: 'Scheduler status', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  return c.json({ active: true, time: new Date().toISOString() })
})
