import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { runEmailVerifierBatch } from '../../../backend/core/email-finder'
import { EmailVerifierBatchSchema } from '../validation/schemas'

export const emailVerifierRouter = new OpenAPIHono()

emailVerifierRouter.openapi({
  method: 'post',
  path: '/batch',
  summary: 'Verify emails for multiple leads',
  tags: ['EmailVerifier'],
  request: {
    body: { content: { 'application/json': { schema: EmailVerifierBatchSchema } } },
  },
  responses: {
    200: { description: 'Verification complete' },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  await runEmailVerifierBatch(leadIds, (done, total, leadId) => {
    wsHub.broadcast('emailVerifier:progress', { done, total, leadId })
  })
  return c.json({ success: true })
})
