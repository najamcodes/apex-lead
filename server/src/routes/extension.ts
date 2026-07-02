import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getDataSource } from '../../../backend/db'
import { LeadEntity } from '../../../backend/db/entities/LeadEntity'
import { getTenantId } from '../../../backend/db/queries/tenant'
import { ExtensionLeadsSchema } from '../validation/schemas'

export const extensionRouter = new OpenAPIHono()

// Health check for extension
extensionRouter.openapi({
  method: 'get',
  path: '/status',
  summary: 'Extension health check',
  tags: ['Extension'],
  responses: {
    200: { description: 'Extension status', content: { 'application/json': { schema: z.object({ status: z.string(), service: z.string() }) } } },
  },
}, async (c) => {
  return c.json({ status: 'ok', service: 'leadgen-desk-api' })
})

// Receive leads from Chrome extension
extensionRouter.openapi({
  method: 'post',
  path: '/leads',
  summary: 'Import leads from Chrome extension',
  tags: ['Extension'],
  request: {
    body: { content: { 'application/json': { schema: z.union([ExtensionLeadsSchema, ExtensionLeadsSchema.element]) } } },
  },
  responses: {
    200: {
      description: 'Import results',
      content: { 'application/json': { schema: z.object({ results: z.array(z.any()) }) } },
    },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  const leads = Array.isArray(body) ? body : [body]
  
  const results = []
  
  for (const lead of leads) {
    // Check if lead already exists (by business_name + city)
    const existing = await getDataSource().createQueryBuilder()
      .select('id')
      .from('leads', 'leads')
      .where('business_name = :business_name', { business_name: lead.business_name })
      .andWhere('city = :city', { city: lead.city || '' })
      .andWhere('org_id = :orgId', { orgId: getTenantId() })
      .getRawOne()
    
    if (existing) {
      results.push({ status: 'duplicate', id: existing.id, business_name: lead.business_name })
      continue
    }
    
    const entity = getDataSource().getRepository(LeadEntity).create({
      org_id: getTenantId(),
      business_name: lead.business_name,
      category: lead.category || '',
      city: lead.city || '',
      country: lead.country || 'United States',
      phone: lead.phone || null,
      email: lead.email || null,
      website_url: lead.website_url || null,
      google_maps_url: lead.google_maps_url || null,
      website_status: 'unchecked',
      source: 'extension',
      scraped_at: new Date().toISOString(),
    })
    
    const saved = await getDataSource().getRepository(LeadEntity).save(entity)
    results.push({ status: 'created', id: saved.id, business_name: lead.business_name })
  }
  
  return c.json({ results })
})