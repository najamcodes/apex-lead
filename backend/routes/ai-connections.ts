import { Hono } from 'hono'
import { getDataSource } from '../db'
import { AIConnectionEntity } from '../db/entities/AIConnectionEntity'
import { getTenantId } from '../db/queries/tenant'
import { AIClient } from '../core/ai/ai-client'
import { encrypt, decrypt } from '../core/utils/crypto'

export const aiConnectionsRouter = new Hono()

// GET /api/ai-connections — List all AI connection setups for current org
aiConnectionsRouter.get('/', async (c) => {
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(AIConnectionEntity)
  const list = await repo.find({
    where: { org_id: orgId },
    order: { is_default: 'DESC', created_at: 'DESC' },
  })

  // Mask API keys in response
  const safeList = list.map((item) => {
    const rawKey = item.api_key ? decrypt(item.api_key) : ''
    return {
      ...item,
      api_key: rawKey ? (rawKey.length > 8 ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}` : '••••••••') : null,
    }
  })

  return c.json({ data: safeList })
})

// GET /api/ai-connections/:id — Get a single connection
aiConnectionsRouter.get('/:id', async (c) => {
  const { id } = c.req.param()
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(AIConnectionEntity)
  const item = await repo.findOneBy({ id, org_id: orgId })
  if (!item) {
    return c.json({ error: 'AI Connection profile not found' }, 404)
  }
  const rawKey = item.api_key ? decrypt(item.api_key) : ''
  return c.json({
    data: {
      ...item,
      api_key: rawKey ? (rawKey.length > 8 ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}` : '••••••••') : null,
    },
  })
})

// POST /api/ai-connections — Create new AI connection setup
aiConnectionsRouter.post('/', async (c) => {
  const orgId = getTenantId()
  const body = await c.req.json()
  const { name, provider, base_url, api_key, default_model, is_default } = body

  if (!name || !provider) {
    return c.json({ error: 'Name and provider are required' }, 400)
  }

  const repo = getDataSource().getRepository(AIConnectionEntity)

  // If set as default, unset other defaults for this org
  if (is_default) {
    await repo.update({ org_id: orgId }, { is_default: false })
  }

  const encryptedKey = api_key?.trim() ? encrypt(api_key.trim()) : null

  const conn = repo.create({
    org_id: orgId,
    name: name.trim(),
    provider,
    base_url: base_url?.trim() || null,
    api_key: encryptedKey,
    default_model: default_model?.trim() || null,
    is_default: Boolean(is_default),
  })

  await repo.save(conn)
  return c.json({ data: conn }, 201)
})

// PUT /api/ai-connections/:id — Update AI connection setup
aiConnectionsRouter.put('/:id', async (c) => {
  const { id } = c.req.param()
  const orgId = getTenantId()
  const body = await c.req.json()
  const repo = getDataSource().getRepository(AIConnectionEntity)

  const existing = await repo.findOneBy({ id, org_id: orgId })
  if (!existing) {
    return c.json({ error: 'AI Connection profile not found' }, 404)
  }

  if (body.is_default && !existing.is_default) {
    await repo.update({ org_id: orgId }, { is_default: false })
  }

  if (body.name !== undefined) existing.name = body.name.trim()
  if (body.provider !== undefined) existing.provider = body.provider
  if (body.base_url !== undefined) existing.base_url = body.base_url?.trim() || null
  if (body.api_key !== undefined && !body.api_key.includes('••') && !body.api_key.includes('...')) {
    existing.api_key = body.api_key?.trim() ? encrypt(body.api_key.trim()) : null
  }
  if (body.default_model !== undefined) existing.default_model = body.default_model?.trim() || null
  if (body.is_default !== undefined) existing.is_default = Boolean(body.is_default)

  await repo.save(existing)
  return c.json({ data: existing })
})

// DELETE /api/ai-connections/:id — Delete AI connection setup
aiConnectionsRouter.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(AIConnectionEntity)
  const existing = await repo.findOneBy({ id, org_id: orgId })
  if (!existing) {
    return c.json({ error: 'AI Connection profile not found' }, 404)
  }

  await repo.remove(existing)
  return c.json({ ok: true })
})

// POST /api/ai-connections/:id/set-default — Set as default setup
aiConnectionsRouter.post('/:id/set-default', async (c) => {
  const { id } = c.req.param()
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(AIConnectionEntity)

  const target = await repo.findOneBy({ id, org_id: orgId })
  if (!target) {
    return c.json({ error: 'AI Connection profile not found' }, 404)
  }

  await repo.update({ org_id: orgId }, { is_default: false })
  target.is_default = true
  await repo.save(target)

  return c.json({ ok: true, data: target })
})

// POST /api/ai-connections/:id/test — Test connectivity for a specific profile
aiConnectionsRouter.post('/:id/test', async (c) => {
  const { id } = c.req.param()
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(AIConnectionEntity)
  const conn = await repo.findOneBy({ id, org_id: orgId })
  if (!conn) {
    return c.json({ error: 'AI Connection profile not found' }, 404)
  }

  const rawKey = conn.api_key ? decrypt(conn.api_key) : null

  const client = new AIClient({
    id: conn.id,
    name: conn.name,
    provider: conn.provider,
    baseUrl: conn.base_url,
    apiKey: rawKey,
    defaultModel: conn.default_model,
  })

  const testModel = conn.default_model ||
    (conn.provider === 'anthropic' || conn.provider === 'custom_claude'
      ? 'claude-3-5-sonnet-20241022'
      : conn.provider === 'ollama'
      ? 'llama3'
      : conn.provider === 'lmstudio'
      ? 'default'
      : 'gpt-4o-mini')

  const start = Date.now()
  try {
    const res = await client.complete({
      model: testModel,
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 10,
      temperature: 0.1,
    })
    const latencyMs = Date.now() - start
    return c.json({
      ok: true,
      name: conn.name,
      provider: conn.provider,
      model: res.model || testModel,
      response: res.content.trim(),
      latencyMs,
    })
  } catch (err: any) {
    return c.json({
      ok: false,
      name: conn.name,
      provider: conn.provider,
      error: err.message,
      latencyMs: Date.now() - start,
    }, 400)
  }
})
