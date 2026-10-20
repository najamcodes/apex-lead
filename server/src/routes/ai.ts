import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import { scoreSite } from '@sdk/core/ai/tasks/score-site'
import { draftOutreach } from '@sdk/core/ai/tasks/draft-outreach'
import { getSettings } from '@sdk/backend/db/queries/settings.queries'
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

aiRouter.post('/test-connection', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const currentSettings = await getSettings()
  const mergedSettings = { ...currentSettings, ...body }
  const { AIClient } = await import('@sdk/core/ai/ai-client')
  const client = new AIClient(mergedSettings)

  const testModel = body.model ||
    (mergedSettings.ai_provider === 'anthropic' || mergedSettings.ai_provider === 'custom_claude'
      ? 'claude-3-5-sonnet-20241022'
      : mergedSettings.ai_provider === 'ollama'
      ? 'llama3'
      : mergedSettings.ai_provider === 'lmstudio'
      ? 'default'
      : mergedSettings.ai_model_site_scoring || 'gpt-4o-mini')

  const start = Date.now()
  try {
    const res = await client.complete({
      model: testModel,
      messages: [
        { role: 'user', content: 'Reply with the exact word "PONG" and nothing else.' },
      ],
      max_tokens: 20,
      temperature: 0.1,
    })
    const latencyMs = Date.now() - start
    return c.json({
      ok: true,
      provider: mergedSettings.ai_provider,
      model: res.model || testModel,
      response: res.content.trim(),
      latencyMs,
    })
  } catch (err: any) {
    return c.json({
      ok: false,
      provider: mergedSettings.ai_provider,
      error: err.message,
      latencyMs: Date.now() - start,
    }, 400)
  }
})