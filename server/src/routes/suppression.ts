import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import {
  getAllSuppressions,
  addSuppression,
  batchAddSuppressions,
  removeSuppression,
  isSuppressed,
} from '@sdk/backend/db/queries/suppression.queries'

export const suppressionRouter = new OpenAPIHono()

const SuppressionItemSchema = z.object({
  id: z.number(),
  org_id: z.number(),
  type: z.enum(['email', 'domain', 'phone']),
  value: z.string(),
  reason: z.enum(['unsubscribed', 'manual', 'bounced', 'complaint']),
  created_at: z.any(),
})

const AddSuppressionSchema = z.object({
  value: z.string().min(1),
  type: z.enum(['email', 'domain', 'phone']).optional(),
  reason: z.enum(['unsubscribed', 'manual', 'bounced', 'complaint']).optional(),
})

const BatchSuppressionSchema = z.object({
  values: z.array(z.string().min(1)),
  type: z.enum(['email', 'domain', 'phone']).optional(),
  reason: z.enum(['unsubscribed', 'manual', 'bounced', 'complaint']).optional(),
})

// GET /api/suppression - List suppressed contacts/domains
suppressionRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'List all suppressed contacts and domains',
  tags: ['Suppression'],
  request: {
    query: z.object({
      page: z.string().optional().transform(v => (v ? Number(v) : 1)),
      pageSize: z.string().optional().transform(v => (v ? Number(v) : 50)),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of suppressions',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(SuppressionItemSchema),
            total: z.number(),
          }),
        },
      },
    },
  },
}, async (c) => {
  const query = c.req.valid('query')
  const user = (c as any).get('user')
  const orgId = user?.org_id || 1
  const result = await getAllSuppressions(orgId, query)
  return c.json(result as any)
})

// POST /api/suppression - Add a suppression
suppressionRouter.openapi({
  method: 'post',
  path: '/',
  summary: 'Add an email or domain to the suppression list',
  tags: ['Suppression'],
  request: {
    body: {
      content: { 'application/json': { schema: AddSuppressionSchema } },
    },
  },
  responses: {
    201: {
      description: 'Suppression added',
      content: { 'application/json': { schema: SuppressionItemSchema } },
    },
    400: { description: 'Invalid body' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  const user = (c as any).get('user')
  const orgId = user?.org_id || 1
  const result = await addSuppression({
    org_id: orgId,
    value: body.value,
    type: body.type,
    reason: body.reason,
  })
  return c.json(result as any, 201)
})

// POST /api/suppression/batch - Batch add suppressions
suppressionRouter.openapi({
  method: 'post',
  path: '/batch',
  summary: 'Batch add emails/domains to suppression list',
  tags: ['Suppression'],
  request: {
    body: {
      content: { 'application/json': { schema: BatchSuppressionSchema } },
    },
  },
  responses: {
    200: {
      description: 'Batch results',
      content: {
        'application/json': {
          schema: z.object({ added: z.number(), skipped: z.number() }),
        },
      },
    },
  },
}, async (c) => {
  const body = c.req.valid('json')
  const user = (c as any).get('user')
  const orgId = user?.org_id || 1
  const result = await batchAddSuppressions(body.values, body.type, body.reason, orgId)
  return c.json(result)
})

// DELETE /api/suppression/:id - Remove suppression
suppressionRouter.openapi({
  method: 'delete',
  path: '/:id',
  summary: 'Remove an entry from the suppression list',
  tags: ['Suppression'],
  request: {
    params: z.object({
      id: z.string().transform(Number).pipe(z.number().int().positive()),
    }),
  },
  responses: {
    200: {
      description: 'Suppression removed',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const user = (c as any).get('user')
  const orgId = user?.org_id || 1
  const success = await removeSuppression(id, orgId)
  return c.json({ success })
})

// GET /api/suppression/check - Check if a value is suppressed
suppressionRouter.openapi({
  method: 'get',
  path: '/check',
  summary: 'Check if an email or domain is on the suppression list',
  tags: ['Suppression'],
  request: {
    query: z.object({ query: z.string() }),
  },
  responses: {
    200: {
      description: 'Check result',
      content: { 'application/json': { schema: z.object({ suppressed: z.boolean() }) } },
    },
  },
}, async (c) => {
  const { query } = c.req.valid('query')
  const user = (c as any).get('user')
  const orgId = user?.org_id || 1
  const suppressed = await isSuppressed(query, orgId)
  return c.json({ suppressed })
})
