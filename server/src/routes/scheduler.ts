import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getSchedulerStatus } from '../../../electron/scheduler'

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
  const status = getSchedulerStatus()
  return c.json(status)
})
