import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import {
  sendOutreachRecord,
  processDueOutreach,
  createSequenceForLead,
  initSmtp
} from '@sdk/core/outreach'
import {
  getAllOutreach,
  updateOutreachStatus,
  getSequenceSummaries,
  getPendingOutreachQueue
} from '@sdk/backend/db/queries/outreach.queries'
import { exportLeadsToCsv } from '@sdk/core/outreach/csv-export'
import { getChartData, getFunnelData } from '@sdk/backend/db/queries/stats.queries'
import { logActivity } from '@sdk/backend/db/queries/activity.queries'
import { getDataSource } from '@sdk/backend/db'
import { getRawEmailAccountById } from '@sdk/backend/db/queries/email-accounts.queries'
import { verifySmtp } from '@sdk/core/outreach/smtp-sender'
import { EmailAccountEntity } from '@sdk/backend/db/entities/EmailAccountEntity'
import {
  OutreachSendSchema,
  OutreachBatchSchema,
  OutreachRepliedSchema,
  OutreachBouncedSchema,
  OutreachScheduleSchema,
  SMTPVerifySchema,
} from '../validation/schemas'

export const outreachRouter = new OpenAPIHono()

outreachRouter.openapi({
  method: 'post',
  path: '/:id/send',
  summary: 'Send a single outreach record',
  tags: ['Outreach'],
  request: {
    params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }),
  },
  responses: {
    200: { description: 'Send result', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const id = c.req.valid('param').id
  const result = await sendOutreachRecord(id)
  return c.json(result)
})

outreachRouter.openapi({
  method: 'post',
  path: '/send-batch',
  summary: 'Process all due outreach',
  tags: ['Outreach'],
  request: { body: { content: { 'application/json': { schema: z.object({}) } } } },
  responses: {
    200: { description: 'Batch results', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const result = await processDueOutreach()
  return c.json(result)
})

outreachRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'Get all outreach records',
  tags: ['Outreach'],
  request: { query: z.object({ status: z.string().optional(), page: z.string().optional(), pageSize: z.string().optional() }) },
  responses: {
    200: { description: 'Paginated outreach records', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const q = c.req.query()
  const result = await getAllOutreach(q.status as any, q as any)
  return c.json(result)
})

outreachRouter.openapi({
  method: 'patch',
  path: '/:id/replied',
  summary: 'Mark outreach as replied',
  tags: ['Outreach'],
  request: { params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }) },
  responses: { 200: { description: 'Marked as replied' } },
}, async (c) => {
  const id = c.req.valid('param').id
  await updateOutreachStatus(id, 'replied', { replied_at: new Date().toISOString() })
  const record = await getDataSource().createQueryBuilder()
    .select('lead_id')
    .from('outreach', 'o')
    .where('id = :id', { id })
    .getRawOne()
  if (record) {
    await getDataSource().createQueryBuilder()
      .update('leads')
      .set({ status: 'replied', updated_at: () => "datetime('now')" })
      .where('id = :id', { id: record.lead_id })
      .execute()
    await logActivity(record.lead_id, 'email_replied')
  }
  return c.json({ success: true })
})

outreachRouter.openapi({
  method: 'patch',
  path: '/:id/bounced',
  summary: 'Mark outreach as bounced',
  tags: ['Outreach'],
  request: { params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }) },
  responses: { 200: { description: 'Marked as bounced' } },
}, async (c) => {
  const id = c.req.valid('param').id
  await updateOutreachStatus(id, 'bounced')
  const record = await getDataSource().createQueryBuilder()
    .select('lead_id')
    .from('outreach', 'o')
    .where('id = :id', { id })
    .getRawOne()
  if (record) await logActivity(record.lead_id, 'email_bounced')
  return c.json({ success: true })
})

outreachRouter.openapi({
  method: 'post',
  path: '/schedule-sequence',
  summary: 'Schedule a sequence for a lead',
  tags: ['Outreach'],
  request: { body: { content: { 'application/json': { schema: z.object({ input: z.any(), businessName: z.string() }) } } } },
  responses: { 200: { description: 'Sequence scheduled' } },
}, async (c) => {
  const { input, businessName } = await c.req.json()
  const res = await createSequenceForLead(input, businessName)
  return c.json(res)
})

outreachRouter.openapi({
  method: 'get',
  path: '/sequences',
  summary: 'Get sequence summaries',
  tags: ['Outreach'],
  request: { query: z.object({}) },
  responses: { 200: { description: 'Sequence summaries', content: { 'application/json': { schema: z.any() } } } },
}, async (c) => {
  const q = c.req.query()
  const result = await getSequenceSummaries(q as any)
  return c.json(result)
})

outreachRouter.openapi({
  method: 'get',
  path: '/export-csv',
  summary: 'Export outreach leads to CSV',
  tags: ['Outreach'],
  responses: {
    200: { description: 'CSV data', content: { 'application/json': { schema: z.object({ csv: z.string() }) } } },
  },
}, async (c) => {
  const result = await exportLeadsToCsv()
  return c.json({ csv: result })
})

outreachRouter.openapi({
  method: 'get',
  path: '/pending-queue',
  summary: 'Get pending outreach queue',
  tags: ['Outreach'],
  responses: { 200: { description: 'Pending queue', content: { 'application/json': { schema: z.any() } } } },
}, async (c) => {
  const result = await getPendingOutreachQueue()
  return c.json(result)
})

outreachRouter.openapi({
  method: 'get',
  path: '/chart-data',
  summary: 'Get chart data for outreach dashboard',
  tags: ['Outreach'],
  responses: {
    200: { description: 'Chart data', content: { 'application/json': { schema: z.object({ weekly: z.array(z.any()), funnel: z.array(z.any()) }) } } },
  },
}, async (c: any) => {
  const weekly = await getChartData(14)
  const funnel = await getFunnelData()
  return c.json({ weekly, funnel } as any, 200)
})

outreachRouter.openapi({
  method: 'get',
  path: '/smtp/verify',
  summary: 'Verify SMTP connection',
  tags: ['Outreach'],
  request: {
    query: z.object({
      accountId: z.string().optional().transform(v => v ? Number(v) : undefined)
    })
  },
  responses: { 200: { description: 'SMTP verification result', content: { 'application/json': { schema: z.any() } } } },
}, async (c) => {
  const q = c.req.valid('query')
  const accountId = q.accountId
  let account = accountId ? await getRawEmailAccountById(accountId) : null
  if (!account) {
    const accounts = await getDataSource().getRepository(EmailAccountEntity).find({ where: { org_id: (c as any).get('user')?.org_id || 1 } })
    account = accounts[0] || null
  }
  if (!account) return c.json({ ok: false, error: 'No email account found' })
  const result = await verifySmtp(account)
  return c.json(result)
})

outreachRouter.openapi({
  method: 'post',
  path: '/smtp/reinit',
  summary: 'Reinitialize SMTP',
  tags: ['Outreach'],
  responses: { 200: { description: 'SMTP reinitialized' } },
}, async (c) => {
  initSmtp()
  return c.json({ success: true })
})
