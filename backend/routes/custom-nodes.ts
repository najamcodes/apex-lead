// backend/routes/custom-nodes.ts
// REST API for managing user-created custom nodes & plugins with RBAC.

import { Hono } from 'hono'
import { getDataSource } from '../db'
import { CustomNodeEntity } from '../db/entities/CustomNodeEntity'
import { getTenantId, getCurrentUserId, canViewPipelines, canManagePlugins } from '../db/queries/tenant'
import { registerCustomNodeHandler } from '../engine/custom-nodes'

export const customNodesRouter = new Hono()

// GET /api/custom-nodes — List all custom nodes for current org
customNodesRouter.get('/', async (c) => {
  if (!canViewPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to view nodes' }, 403)
  }

  const orgId = getTenantId()
  const repo = getDataSource().getRepository(CustomNodeEntity)
  const list = await repo.find({
    where: { org_id: orgId },
    order: { created_at: 'DESC' },
  })

  return c.json({ data: list })
})

// GET /api/custom-nodes/:id — Get details of a single custom node
customNodesRouter.get('/:id', async (c) => {
  if (!canViewPipelines()) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { id } = c.req.param()
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(CustomNodeEntity)
  const node = await repo.findOneBy({ id, org_id: orgId })
  if (!node) {
    return c.json({ error: 'Custom node not found' }, 404)
  }

  return c.json({ data: node })
})

// POST /api/custom-nodes — Create a new user-made custom node
customNodesRouter.post('/', async (c) => {
  if (!canManagePlugins()) {
    return c.json({ error: 'Forbidden: You do not have permission to create custom nodes/plugins' }, 403)
  }

  const orgId = getTenantId()
  const userId = getCurrentUserId()
  const body = await c.req.json()
  const { name, node_key, description, category, icon, color, code, config_schema, inputs, outputs, enabled } = body

  if (!name || !code) {
    return c.json({ error: 'Name and JavaScript code are required' }, 400)
  }

  const repo = getDataSource().getRepository(CustomNodeEntity)
  const node = repo.create({
    org_id: orgId,
    name: name.trim(),
    node_key: node_key?.trim() || `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
    description: description?.trim() || null,
    category: category?.trim() || 'Custom',
    icon: icon?.trim() || 'Code',
    color: color?.trim() || '#6366f1',
    code: code.trim(),
    config_schema: typeof config_schema === 'object' ? JSON.stringify(config_schema) : (config_schema || '{}'),
    inputs: typeof inputs === 'object' ? JSON.stringify(inputs) : (inputs || '[{"id":"main","label":"Input"}]'),
    outputs: typeof outputs === 'object' ? JSON.stringify(outputs) : (outputs || '[{"id":"main","label":"Output"}]'),
    enabled: enabled !== false,
    created_by: userId,
  })

  await repo.save(node)

  // Dynamically register into the running DAG registry
  if (node.enabled) {
    try {
      registerCustomNodeHandler(node)
    } catch (err: any) {
      console.warn(`[custom-nodes] Registration warning for ${node.id}:`, err.message)
    }
  }

  return c.json({ data: node }, 201)
})

// PUT /api/custom-nodes/:id — Update a custom node
customNodesRouter.put('/:id', async (c) => {
  if (!canManagePlugins()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to manage plugins' }, 403)
  }

  const { id } = c.req.param()
  const orgId = getTenantId()
  const body = await c.req.json()
  const repo = getDataSource().getRepository(CustomNodeEntity)

  const existing = await repo.findOneBy({ id, org_id: orgId })
  if (!existing) {
    return c.json({ error: 'Custom node not found' }, 404)
  }

  if (body.name !== undefined) existing.name = body.name.trim()
  if (body.node_key !== undefined) existing.node_key = body.node_key.trim()
  if (body.description !== undefined) existing.description = body.description?.trim() || null
  if (body.category !== undefined) existing.category = body.category?.trim() || 'Custom'
  if (body.icon !== undefined) existing.icon = body.icon?.trim() || 'Code'
  if (body.color !== undefined) existing.color = body.color?.trim() || '#6366f1'
  if (body.code !== undefined) existing.code = body.code.trim()
  if (body.config_schema !== undefined) {
    existing.config_schema = typeof body.config_schema === 'object' ? JSON.stringify(body.config_schema) : body.config_schema
  }
  if (body.inputs !== undefined) {
    existing.inputs = typeof body.inputs === 'object' ? JSON.stringify(body.inputs) : body.inputs
  }
  if (body.outputs !== undefined) {
    existing.outputs = typeof body.outputs === 'object' ? JSON.stringify(body.outputs) : body.outputs
  }
  if (body.enabled !== undefined) existing.enabled = Boolean(body.enabled)

  await repo.save(existing)

  if (existing.enabled) {
    registerCustomNodeHandler(existing)
  }

  return c.json({ data: existing })
})

// DELETE /api/custom-nodes/:id — Delete a custom node
customNodesRouter.delete('/:id', async (c) => {
  if (!canManagePlugins()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to manage plugins' }, 403)
  }

  const { id } = c.req.param()
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(CustomNodeEntity)
  const existing = await repo.findOneBy({ id, org_id: orgId })
  if (!existing) {
    return c.json({ error: 'Custom node not found' }, 404)
  }

  await repo.remove(existing)
  return c.json({ ok: true })
})

// POST /api/custom-nodes/:id/test — Execute custom node with sample record input
customNodesRouter.post('/:id/test', async (c) => {
  const { id } = c.req.param()
  const orgId = getTenantId()
  const body = await c.req.json().catch(() => ({}))
  const sampleInput = body.input || { business_name: 'Acme Dental', city: 'Austin', rating: 4.8 }
  const sampleConfig = body.config || {}

  const repo = getDataSource().getRepository(CustomNodeEntity)
  const node = await repo.findOneBy({ id, org_id: orgId })
  if (!node) {
    return c.json({ error: 'Custom node not found' }, 404)
  }

  const emitted: any[] = []
  const logs: Array<{ level: string; message: string; timestamp: string }> = []

  const mockCtx = {
    input: sampleInput,
    incoming: [{ id: 'mock-1', collection: 'test', data: sampleInput, meta: { pipelineId: 'test', runId: 'test', sourceNodeId: 'test', orgId, createdAt: new Date().toISOString(), trace: [] } }],
    config: sampleConfig,
    log: (level: 'info' | 'warn' | 'error', msg: string) => {
      logs.push({ level, message: msg, timestamp: new Date().toISOString() })
    },
    emit: (rec: any) => {
      emitted.push(rec)
    },
    isCancelled: () => false,
    isPaused: async () => {},
  }

  const start = Date.now()
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const fn = new AsyncFunction('sandbox', `
      with (sandbox) {
        ${node.code}
      }
    `)

    await fn({
      ctx: mockCtx,
      input: mockCtx.input,
      incoming: mockCtx.incoming,
      config: mockCtx.config,
      log: mockCtx.log,
      emit: mockCtx.emit,
      console: {
        log: (...args: any[]) => mockCtx.log('info', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        warn: (...args: any[]) => mockCtx.log('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args: any[]) => mockCtx.log('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      },
    })

    const durationMs = Date.now() - start
    return c.json({
      ok: true,
      nodeName: node.name,
      durationMs,
      emitted,
      logs,
    })
  } catch (err: any) {
    return c.json({
      ok: false,
      error: err.message,
      durationMs: Date.now() - start,
      logs,
    }, 400)
  }
})
