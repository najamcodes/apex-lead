import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { analyzeBatch } from '../../../backend/core/analysis'
import { scoreSite } from '../../../backend/core/ai/tasks/score-site'
import { getSettings } from '../../../backend/db/queries/settings.queries'
import { getDataSource } from '../../../backend/db'
import { getTenantId } from '../../../backend/db/queries/tenant'
import { logActivity, getActivityByLead, getRecentActivity } from '../../../backend/db/queries/activity.queries'
import { getNoteByLead, saveNote } from '../../../backend/db/queries/notes.queries'
import { EmailTemplateEntity } from '../../../backend/db/entities/EmailTemplateEntity'
import { runEmailFinderBatch, findEmailForLead, runEmailVerifierBatch } from '../../../backend/core/email-finder'
import { createSequenceForLead } from '../../../backend/core/outreach'
import { getSchedulerStatus } from '../../../electron/scheduler'
import { parseSpintax } from '../../../backend/core/outreach/spintax'
import { draftOutreach } from '../../../backend/core/ai/tasks/draft-outreach'
import {
  BulkAnalyzeSchema,
  BulkScoreSchema,
  BulkApproveSchema,
  BulkScheduleSequencesSchema,
  NoteUpdateSchema,
} from '../validation/schemas'

export const bulkRouter = new OpenAPIHono()

// NOTES
bulkRouter.openapi({
  method: 'get',
  path: '/leads/:id/notes',
  summary: 'Get note for a lead',
  tags: ['Notes'],
  request: { params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }) },
  responses: { 200: { description: 'Note', content: { 'application/json': { schema: z.any() } } } },
}, async (c) => {
  const id = c.req.valid('param').id
  const note = await getNoteByLead(id)
  return c.json(note)
})

bulkRouter.openapi({
  method: 'put',
  path: '/leads/:id/notes',
  summary: 'Save note for a lead',
  tags: ['Notes'],
  request: {
    params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }),
    body: { content: { 'application/json': { schema: NoteUpdateSchema } } },
  },
  responses: { 200: { description: 'Note saved', content: { 'application/json': { schema: z.any() } } } },
}, async (c) => {
  const id = c.req.valid('param').id
  const { body } = c.req.valid('json')
  await logActivity(id, 'note_added', 'Added a note to the lead')
  const note = await saveNote(id, body)
  return c.json(note)
})

// ACTIVITY
bulkRouter.openapi({
  method: 'get',
  path: '/leads/:id/activity',
  summary: 'Get activity for a lead',
  tags: ['Activity'],
  request: { params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }) },
  responses: { 200: { description: 'Activity', content: { 'application/json': { schema: z.array(z.any()) } } } },
}, async (c) => {
  const id = c.req.valid('param').id
  const activity = await getActivityByLead(id)
  return c.json(activity)
})

bulkRouter.openapi({
  method: 'get',
  path: '/activity/recent',
  summary: 'Get recent activity',
  tags: ['Activity'],
  responses: { 200: { description: 'Recent activity', content: { 'application/json': { schema: z.array(z.any()) } } } },
}, async (c) => {
  const activity = await getRecentActivity()
  return c.json(activity)
})

// EMAIL FINDER
bulkRouter.openapi({
  method: 'post',
  path: '/email-finder/lead/:id',
  summary: 'Find email for a single lead',
  tags: ['Email Finder'],
  request: { params: z.object({ id: z.string().transform(Number).pipe(z.number().int().positive()) }) },
  responses: { 200: { description: 'Found email', content: { 'application/json': { schema: z.object({ email: z.string().nullable() }) } } } },
}, async (c) => {
  const id = c.req.valid('param').id
  const email = await findEmailForLead(id)
  return c.json({ email })
})

bulkRouter.openapi({
  method: 'post',
  path: '/email-finder/batch',
  summary: 'Find emails for multiple leads',
  tags: ['Email Finder'],
  request: { body: { content: { 'application/json': { schema: z.object({ leadIds: z.array(z.number().int().positive()).min(1) }) } } } },
  responses: { 200: { description: 'Batch started' } },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  await runEmailFinderBatch(leadIds, (done, total, leadId) => {
    wsHub.broadcast('emailFinder:progress', { done, total, leadId })
  })
  return c.json({ success: true })
})

// EMAIL VERIFIER
bulkRouter.openapi({
  method: 'post',
  path: '/email-verifier/batch',
  summary: 'Verify emails for multiple leads',
  tags: ['Email Verifier'],
  request: { body: { content: { 'application/json': { schema: z.object({ leadIds: z.array(z.number().int().positive()).min(1) }) } } } },
  responses: { 200: { description: 'Batch started' } },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  await runEmailVerifierBatch(leadIds, (done, total, leadId) => {
    wsHub.broadcast('emailVerifier:progress', { done, total, leadId })
  })
  return c.json({ success: true })
})

// SCHEDULER
bulkRouter.openapi({
  method: 'get',
  path: '/scheduler/status',
  summary: 'Get scheduler status',
  tags: ['Scheduler'],
  responses: { 200: { description: 'Scheduler status', content: { 'application/json': { schema: z.boolean() } } } },
}, async (c) => {
  const status = getSchedulerStatus()
  return c.json(status)
})

// BULK ACTIONS
bulkRouter.openapi({
  method: 'post',
  path: '/analyze',
  summary: 'Batch analyze leads',
  tags: ['Bulk Actions'],
  request: { body: { content: { 'application/json': { schema: BulkAnalyzeSchema } } } },
  responses: { 200: { description: 'Batch started' } },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  await analyzeBatch(leadIds, (done, total, leadId) => {
    wsHub.broadcast('analysis:progress', { done, total, leadId })
  })
  return c.json({ success: true })
})

bulkRouter.openapi({
  method: 'post',
  path: '/score',
  summary: 'Batch score leads',
  tags: ['Bulk Actions'],
  request: { body: { content: { 'application/json': { schema: BulkScoreSchema } } } },
  responses: { 200: { description: 'Batch started' } },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  const settings = await getSettings()
  if (!settings.ai_enabled) return c.json({ success: true })
  for (const id of leadIds) {
    try {
      await scoreSite(settings, id, settings.ai_model_site_scoring)
      await new Promise((r) => setTimeout(r, 1000))
    } catch { }
  }
  return c.json({ success: true })
})

bulkRouter.openapi({
  method: 'post',
  path: '/approve',
  summary: 'Batch approve leads',
  tags: ['Bulk Actions'],
  request: { body: { content: { 'application/json': { schema: BulkApproveSchema } } } },
  responses: { 200: { description: 'Leads approved' } },
}, async (c) => {
  const { leadIds } = c.req.valid('json')
  for (const id of leadIds) {
    const current = await getDataSource().createQueryBuilder()
      .select('status')
      .from('leads', 'leads')
      .where('id = :id', { id })
      .andWhere('org_id = :orgId', { orgId: getTenantId() })
      .getRawOne()
    if (current?.status === 'review' || current?.status === 'qualified') {
      await getDataSource().createQueryBuilder()
        .update('leads')
        .set({ status: 'approved', updated_at: () => "datetime('now')" })
        .where('id = :id', { id })
        .andWhere('org_id = :orgId', { orgId: getTenantId() })
        .execute()
      await logActivity(id, 'lead_approved', 'Bulk approved')
    }
  }
  return c.json({ success: true })
})

bulkRouter.openapi({
  method: 'post',
  path: '/schedule-sequences',
  summary: 'Batch schedule sequences',
  tags: ['Bulk Actions'],
  request: { body: { content: { 'application/json': { schema: BulkScheduleSequencesSchema } } } },
  responses: { 200: { description: 'Sequences scheduled' } },
}, async (c) => {
  const { leadIds, templateId } = c.req.valid('json')
  const settings = await getSettings()
  let template: EmailTemplateEntity | null = null
  if (templateId) {
    const tmplRepo = getDataSource().getRepository(EmailTemplateEntity)
    template = await tmplRepo.findOneBy({ id: templateId, org_id: getTenantId() })
  }
  for (const id of leadIds) {
    try {
      const lead = await getDataSource().createQueryBuilder()
        .select('*')
        .from('leads', 'leads')
        .where('id = :id', { id })
        .andWhere('org_id = :orgId', { orgId: getTenantId() })
        .getRawOne()
      if (lead && lead.email) {
        let subject = ''
        let body = ''
        if (template) {
          subject = template.subject
            .replace(/{{business_name}}/gi, lead.business_name || '')
            .replace(/{{city}}/gi, lead.city || '')
            .replace(/{{ai_hook}}/gi, lead.ai_personalized_hook || '')
          body = template.body
            .replace(/{{business_name}}/gi, lead.business_name || '')
            .replace(/{{city}}/gi, lead.city || '')
            .replace(/{{ai_hook}}/gi, lead.ai_personalized_hook || '')
          subject = parseSpintax(subject)
          body = parseSpintax(body)
        } else {
          if (settings.ai_enabled) {
            const draft = await draftOutreach(settings, id, settings.developer_name || 'Your Name', settings.ai_model_email_draft)
            subject = draft.subject
            body = draft.email_body
          } else {
            throw new Error('No openrouter api key found to draft email')
          }
        }
        await createSequenceForLead({ lead_id: id, email: lead.email, subject, email_body: body }, lead.business_name)
      }
    } catch (err) {
      console.error(`Failed to schedule sequence for lead ${id}:`, err)
    }
  }
  return c.json({ success: true })
})