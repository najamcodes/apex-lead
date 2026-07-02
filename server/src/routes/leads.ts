import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getAllLeads, getLeadById, insertLead, updateLeadStatus, deleteLead } from '../../../backend/db/queries/leads.queries'
import { logActivity } from '../../../backend/db/queries/activity.queries'
import { getDashboardStats, getCityRoiStats, getChartData, getFunnelData } from '../../../backend/db/queries/stats.queries'
import {
  PaginationSchema,
  LeadFiltersSchema,
  LeadInsertSchema,
  LeadStatusUpdateSchema,
} from '../validation/schemas'

export const leadsRouter = new OpenAPIHono()

// GET /api/leads - Get all leads with filters
leadsRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'Get all leads with filtering and pagination',
  tags: ['Leads'],
  request: {
    query: LeadFiltersSchema,
  },
  responses: {
    200: {
      description: 'Paginated list of leads',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
          }),
        },
      },
    },
    400: { description: 'Invalid query parameters' },
  },
}, async (c) => {
  const query = c.req.valid('query')
  const result = await getAllLeads(query)
  return c.json(result)
})

// GET /api/leads/:id - Get lead by ID
leadsRouter.openapi({
  method: 'get',
  path: '/:id',
  summary: 'Get lead by ID',
  tags: ['Leads'],
  request: {
    params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }),
  },
  responses: {
    200: { description: 'Lead details', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const id = c.req.valid('param').id
  const result = await getLeadById(id)
  if (!result) return c.json({ error: 'Lead not found' }, 404)
  return c.json(result)
})

// POST /api/leads - Create new lead
leadsRouter.openapi({
  method: 'post',
  path: '/',
  summary: 'Create new lead',
  tags: ['Leads'],
  request: {
    body: { content: { 'application/json': { schema: LeadInsertSchema } } },
  },
  responses: {
    201: { description: 'Lead created', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request body' },
    409: { description: 'Lead already exists' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  const result = await insertLead(body)
  if (!result) return c.json({ error: 'Lead already exists' }, 409)
  return c.json(result, 201)
})

// PATCH /api/leads/:id/status - Update lead status
leadsRouter.openapi({
  method: 'patch',
  path: '/:id/status',
  summary: 'Update lead status',
  tags: ['Leads'],
  request: {
    params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }),
    body: { content: { 'application/json': { schema: LeadStatusUpdateSchema } } },
  },
  responses: {
    200: { description: 'Status updated' },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const id = c.req.valid('param').id
  const { status, notes } = c.req.valid('json')
  await updateLeadStatus(id, status, notes)
  if (status === 'approved') await logActivity(id, 'lead_approved', notes)
  if (status === 'skipped') await logActivity(id, 'lead_skipped', notes)
  return c.json({ success: true })
})

// DELETE /api/leads/:id - Delete lead
leadsRouter.openapi({
  method: 'delete',
  path: '/:id',
  summary: 'Delete lead',
  tags: ['Leads'],
  request: {
    params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }),
  },
  responses: {
    200: { description: 'Lead deleted' },
    404: { description: 'Lead not found' },
  },
}, async (c) => {
  const id = c.req.valid('param').id
  await deleteLead(id)
  return c.json({ success: true })
})

export const statsRouter = new OpenAPIHono()

// GET /api/stats/dashboard - Dashboard statistics
statsRouter.openapi({
  method: 'get',
  path: '/dashboard',
  summary: 'Get dashboard statistics',
  tags: ['Stats'],
  responses: {
    200: {
      description: 'Dashboard stats',
      content: { 'application/json': { schema: z.any() } },
    },
  },
}, async (c) => {
  const result = await getDashboardStats()
  return c.json(result)
})

// GET /api/stats/city-roi - City ROI statistics
statsRouter.openapi({
  method: 'get',
  path: '/city-roi',
  summary: 'Get city ROI statistics',
  tags: ['Stats'],
  responses: {
    200: {
      description: 'City ROI stats',
      content: { 'application/json': { schema: z.array(z.any()) } },
    },
  },
}, async (c) => {
  const result = await getCityRoiStats()
  return c.json(result)
})

// GET /api/stats/chart-data - Chart data for dashboard
statsRouter.openapi({
  method: 'get',
  path: '/chart-data',
  summary: 'Get chart data for dashboard',
  tags: ['Stats'],
  responses: {
    200: {
      description: 'Chart data',
      content: {
        'application/json': {
          schema: z.object({
            weekly: z.array(z.any()),
            funnel: z.array(z.any()),
          }),
        },
      },
    },
  },
}, async (c) => {
  const weekly = await getChartData(14)
  const funnel = await getFunnelData()
  return c.json({ weekly, funnel })
})