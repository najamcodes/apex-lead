import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getDataSource } from '../../../backend/db'
import { EmailTemplateEntity } from '../../../backend/db/entities/EmailTemplateEntity'
import { getTenantId } from '../../../backend/db/queries/tenant'
import {
  getEmailAccounts, addEmailAccount, updateEmailAccount, deleteEmailAccount, getRawEmailAccountById
} from '../../../backend/db/queries/email-accounts.queries'
import { verifySmtp } from '../../../backend/core/outreach/smtp-sender'
import {
  getAllQueryProfiles, getActiveQueryProfiles, insertQueryProfile, updateQueryProfileStatus, deleteQueryProfile
} from '../../../backend/db/queries/query-profiles.queries'
import {
  IdParamSchema,
  TemplateInsertSchema,
  TemplateUpdateSchema,
  EmailAccountInsertSchema,
  EmailAccountUpdateSchema,
  QueryProfileInsertSchema,
  QueryProfileUpdateSchema,
} from '../validation/schemas'

export const apiRouter = new OpenAPIHono()

// ── Templates ──────────────────────────────────────────────────────

apiRouter.openapi({
  method: 'get',
  path: '/templates',
  summary: 'Get all email templates',
  tags: ['Templates'],
  responses: {
    200: { description: 'List of templates', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  const repo = getDataSource().getRepository(EmailTemplateEntity)
  const templates = await repo.find({ where: { org_id: getTenantId() }, order: { created_at: 'DESC' } })
  return c.json(templates)
})

apiRouter.openapi({
  method: 'post',
  path: '/templates',
  summary: 'Create email template',
  tags: ['Templates'],
  request: {
    body: { content: { 'application/json': { schema: TemplateInsertSchema } } },
  },
  responses: {
    201: { description: 'Template created', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  const repo = getDataSource().getRepository(EmailTemplateEntity)
  const template = repo.create({ ...body, org_id: getTenantId() })
  return c.json(await repo.save(template), 201)
})

apiRouter.openapi({
  method: 'put',
  path: '/templates/:id',
  summary: 'Update email template',
  tags: ['Templates'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: TemplateUpdateSchema } } },
  },
  responses: {
    200: { description: 'Template updated', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Template not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const repo = getDataSource().getRepository(EmailTemplateEntity)
  await repo.update({ id, org_id: getTenantId() }, body)
  const updated = await repo.findOneBy({ id, org_id: getTenantId() })
  if (!updated) return c.json({ error: 'Template not found' }, 404)
  return c.json(updated)
})

apiRouter.openapi({
  method: 'delete',
  path: '/templates/:id',
  summary: 'Delete email template',
  tags: ['Templates'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Template deleted' },
    404: { description: 'Template not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const repo = getDataSource().getRepository(EmailTemplateEntity)
  await repo.delete({ id, org_id: getTenantId() })
  return c.json({ success: true })
})

// ── Email Accounts ─────────────────────────────────────────────────

apiRouter.openapi({
  method: 'get',
  path: '/email-accounts',
  summary: 'Get all email accounts',
  tags: ['EmailAccounts'],
  responses: {
    200: { description: 'List of email accounts', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  return c.json(await getEmailAccounts())
})

apiRouter.openapi({
  method: 'post',
  path: '/email-accounts',
  summary: 'Add email account',
  tags: ['EmailAccounts'],
  request: {
    body: { content: { 'application/json': { schema: EmailAccountInsertSchema } } },
  },
  responses: {
    201: { description: 'Account added', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  return c.json(await addEmailAccount(body), 201)
})

apiRouter.openapi({
  method: 'put',
  path: '/email-accounts/:id',
  summary: 'Update email account',
  tags: ['EmailAccounts'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: EmailAccountUpdateSchema } } },
  },
  responses: {
    200: { description: 'Account updated' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  await updateEmailAccount(id, body)
  return c.json({ success: true })
})

apiRouter.openapi({
  method: 'delete',
  path: '/email-accounts/:id',
  summary: 'Delete email account',
  tags: ['EmailAccounts'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Account deleted' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  await deleteEmailAccount(id)
  return c.json({ success: true })
})

apiRouter.openapi({
  method: 'post',
  path: '/email-accounts/:id/test',
  summary: 'Test email account SMTP connection',
  tags: ['EmailAccounts'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'SMTP test result', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Account not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const account = await getRawEmailAccountById(id)
  if (!account) return c.json({ ok: false, error: 'Account not found' }, 404)
  const result = await verifySmtp(account)
  return c.json(result)
})

// ── Query Profiles ─────────────────────────────────────────────────

apiRouter.openapi({
  method: 'get',
  path: '/query-profiles',
  summary: 'Get all query profiles',
  tags: ['QueryProfiles'],
  responses: {
    200: { description: 'List of query profiles', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  return c.json(await getAllQueryProfiles())
})

apiRouter.openapi({
  method: 'get',
  path: '/query-profiles/active',
  summary: 'Get active query profiles',
  tags: ['QueryProfiles'],
  responses: {
    200: { description: 'Active query profiles', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  return c.json(await getActiveQueryProfiles())
})

apiRouter.openapi({
  method: 'post',
  path: '/query-profiles',
  summary: 'Create query profile',
  tags: ['QueryProfiles'],
  request: {
    body: { content: { 'application/json': { schema: QueryProfileInsertSchema } } },
  },
  responses: {
    201: { description: 'Profile created', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  return c.json(await insertQueryProfile(body), 201)
})

apiRouter.openapi({
  method: 'patch',
  path: '/query-profiles/:id/status',
  summary: 'Update query profile status',
  tags: ['QueryProfiles'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: QueryProfileUpdateSchema } } },
  },
  responses: {
    200: { description: 'Status updated', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const { status } = c.req.valid('json')
  return c.json(await updateQueryProfileStatus(id, status))
})

apiRouter.openapi({
  method: 'delete',
  path: '/query-profiles/:id',
  summary: 'Delete query profile',
  tags: ['QueryProfiles'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Profile deleted', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await deleteQueryProfile(id))
})

// ── Plugins ────────────────────────────────────────────────────────

import {
  getAllPlugins, getPlugin,
  setPluginEnabled, setPluginConfig,
} from '../../../plugins/registry'

const PluginToggleSchema = z.object({ enabled: z.boolean() })
const PluginConfigSchema = z.record(z.string(), z.unknown())

apiRouter.openapi({
  method: 'get',
  path: '/plugins',
  summary: 'List all registered plugins',
  tags: ['Plugins'],
  responses: {
    200: { description: 'Plugin list', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  const plugins = getAllPlugins().map(r => ({
    id:          r.manifest.id,
    kind:        r.manifest.kind,
    name:        r.manifest.name,
    version:     r.manifest.version,
    description: r.manifest.description,
    author:      r.manifest.author,
    tags:        r.manifest.tags ?? [],
    source:      r.source,
    enabled:     r.enabled,
    loadError:   r.loadError ?? null,
  }))
  return c.json(plugins)
})

apiRouter.openapi({
  method: 'get',
  path: '/plugins/:id',
  summary: 'Get plugin details',
  tags: ['Plugins'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Plugin details', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Plugin not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const record = getPlugin(id)
  if (!record) return c.json({ error: 'Plugin not found' }, 404)
  return c.json({
    id:          record.manifest.id,
    kind:        record.manifest.kind,
    name:        record.manifest.name,
    version:     record.manifest.version,
    description: record.manifest.description,
    author:      record.manifest.author,
    tags:        record.manifest.tags ?? [],
    source:      record.source,
    enabled:     record.enabled,
    config:      record.config,
    loadError:   record.loadError ?? null,
  })
})

apiRouter.openapi({
  method: 'patch',
  path: '/plugins/:id/toggle',
  summary: 'Enable or disable a plugin',
  tags: ['Plugins'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: PluginToggleSchema } } },
  },
  responses: {
    200: { description: 'Plugin toggled' },
    404: { description: 'Plugin not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const { enabled } = c.req.valid('json')
  try {
    await setPluginEnabled(id, enabled, getTenantId())
    return c.json({ success: true, enabled })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

apiRouter.openapi({
  method: 'put',
  path: '/plugins/:id/config',
  summary: 'Update plugin configuration',
  tags: ['Plugins'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: PluginConfigSchema } } },
  },
  responses: {
    200: { description: 'Config saved' },
    400: { description: 'Invalid config' },
    404: { description: 'Plugin not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const config = c.req.valid('json')
  try {
    await setPluginConfig(id, config as Record<string, unknown>, getTenantId())
    return c.json({ success: true })
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})

apiRouter.openapi({
  method: 'post',
  path: '/plugins/:id/test',
  summary: 'Test plugin connectivity',
  tags: ['Plugins'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Test result', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Plugin not found' },
    422: { description: 'Plugin type does not support test' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const record = getPlugin(id)
  if (!record) return c.json({ error: 'Plugin not found' }, 404)
  if (record.manifest.kind !== 'connector') {
    return c.json({ error: 'Only connector plugins support connectivity tests' }, 422)
  }
  // For connector plugins: fire a synthetic 'lead.created' event with a dummy lead
  const plugin = record.plugin as import('../../../plugins/types.js').ConnectorPlugin
  const dummyLead: import('../../../plugins/types.js').LeadSnapshot = {
    id: 0, org_id: getTenantId(),
    business_name: 'Test Business', category: 'Test',
    city: 'Test City', country: 'US',
    phone: null, email: null, website_url: null, google_maps_url: null,
    website_status: null, ssl_valid: null, tech_stack: null, social_links: null,
    review_rating: null, review_count: null, ai_site_score: null,
    status: 'scraped', source: 'test',
    scraped_at: new Date().toISOString(),
  }
  try {
    await plugin.push({ trigger: 'lead.created', org_id: getTenantId(), lead: dummyLead, metadata: { test: true } }, record.config)
    return c.json({ success: true, message: 'Test event sent successfully' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message })
  }
})

