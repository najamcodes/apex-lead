// backend/routes/pipelines.ts
// CRUD + run for pipeline definitions. Exposes node-type palette + collections.

import { Hono } from 'hono'
import { getDataSource } from '../db'
import { PipelineDefinitionEntity } from '../db/entities/PipelineDefinitionEntity'
import { PipelineRunEntity } from '../db/entities/PipelineRunEntity'
import { getAllNodeTypes } from '../engine/registry'
import { executePipeline, getRunState } from '../engine/graph'
import { registerBuiltInNodes } from '../nodes'
import { getAllPlugins } from '../../plugins/registry'
import { getAllCollections, getCollectionDefinition } from '../collections/definitions'
import { randomUUID } from 'crypto'
import { getTenantId } from '../db/queries/tenant'
import type { PipelineDefinition, PipelineNode, NodeEdge } from '../../shared/types/pipeline.types'

export const pipelinesRouter = new Hono()

// Ensure node types are registered on first use
let _nodesRegistered = false
function ensureNodes() {
  if (!_nodesRegistered) {
    registerBuiltInNodes()
    _nodesRegistered = true
  }
}

// ─── Node type palette ───────────────────────────────────────────

pipelinesRouter.get('/node-types', (c) => {
  ensureNodes()
  const types = getAllNodeTypes()
  // Enrich scraper/enricher/connector node descriptors with installed plugin ids
  const plugins = getAllPlugins()
  const enriched = types.map(t => {
    if (t.type === 'scraper' || t.type === 'enricher' || t.type === 'connector') {
      const kind = t.type === 'scraper' ? 'scraper' : t.type === 'enricher' ? 'enricher' : 'connector'
      const pluginOptions = plugins.filter(p => p.manifest.kind === kind).map(p => p.manifest.id)
      return {
        ...t,
        configSchema: {
          ...t.configSchema,
          plugin: { ...(t.configSchema.plugin as object), options: pluginOptions },
        },
      }
    }
    return t
  })
  return c.json({ types: enriched })
})

// ─── Collections ─────────────────────────────────────────────────

pipelinesRouter.get('/collections', (c) => {
  const collections = getAllCollections()
  return c.json({ collections })
})

pipelinesRouter.get('/collections/:id', (c) => {
  const def = getCollectionDefinition(c.req.param('id'))
  if (!def) return c.json({ error: 'Collection not found' }, 404)
  return c.json(def)
})

// ─── Pipeline CRUD ───────────────────────────────────────────────

pipelinesRouter.get('/', async (c) => {
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const rows = await repo.find({ where: { org_id: getTenantId() }, order: { updated_at: 'DESC' } })
  return c.json({
    pipelines: rows.map(rowToDefinition),
  })
})

pipelinesRouter.get('/:id', async (c) => {
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const row = await repo.findOneBy({ id: c.req.param('id'), org_id: getTenantId() })
  if (!row) return c.json({ error: 'Pipeline not found' }, 404)
  return c.json(rowToDefinition(row))
})

pipelinesRouter.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  const now = new Date().toISOString()
  const graph = { nodes: body.nodes || [], edges: body.edges || [] }

  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const row = repo.create({
    id,
    org_id: getTenantId(),
    name: body.name || 'Untitled Pipeline',
    description: body.description || null,
    collection: body.collection || 'leads',
    status: body.status || 'draft',
    graph: JSON.stringify(graph),
    trigger: body.trigger ? JSON.stringify(body.trigger) : null,
    version: 1,
    created_at: now,
    updated_at: now,
  })
  await repo.save(row)
  return c.json(rowToDefinition(row), 201)
})

pipelinesRouter.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const existing = await repo.findOneBy({ id, org_id: getTenantId() })
  if (!existing) return c.json({ error: 'Pipeline not found' }, 404)

  if (body.name !== undefined) existing.name = body.name
  if (body.description !== undefined) existing.description = body.description
  if (body.collection !== undefined) existing.collection = body.collection
  if (body.status !== undefined) existing.status = body.status
  if (body.nodes !== undefined || body.edges !== undefined) {
    const current = JSON.parse(existing.graph)
    existing.graph = JSON.stringify({
      nodes: body.nodes ?? current.nodes,
      edges: body.edges ?? current.edges,
    })
  }
  if (body.trigger !== undefined) existing.trigger = body.trigger ? JSON.stringify(body.trigger) : null
  existing.updated_at = new Date().toISOString()

  await repo.save(existing)
  return c.json(rowToDefinition(existing))
})

pipelinesRouter.delete('/:id', async (c) => {
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  await repo.delete({ id: c.req.param('id'), org_id: getTenantId() })
  return c.json({ success: true })
})

// ─── Run pipeline ────────────────────────────────────────────────

const activeRuns = new Map<string, ReturnType<typeof executePipeline>>()

pipelinesRouter.post('/:id/run', async (c) => {
  ensureNodes()
  const id = c.req.param('id')
  const input = await c.req.json().catch(() => ({}))

  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const row = await repo.findOneBy({ id, org_id: getTenantId() })
  if (!row) return c.json({ error: 'Pipeline not found' }, 404)

  const def = rowToDefinition(row)
  const runId = randomUUID()
  const now = new Date().toISOString()

  // Persist run record
  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  await runRepo.save(runRepo.create({
    id: runId,
    pipeline_id: id,
    org_id: getTenantId(),
    status: 'running',
    started_at: now,
    input: JSON.stringify(input),
    stats: '{}',
    log: '[]',
  }))

  const handle = await executePipeline(def, {
    runId,
    input,
    onProgress: (msg) => {
      // Could broadcast via wsHub here
      console.log(`[pipeline ${runId}] ${msg.nodeId ?? ''}: ${msg.message}`)
    },
  })
  activeRuns.set(runId, handle)

  // Background: update run record when done
  ;(async () => {
    // Poll until done (simple approach; could use events)
    const maxWait = 60 * 60 * 1000 // 1 hour
    const start = Date.now()
    while (!handle.isDone() && Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 2000))
      // Update stats periodically
      const state = getRunState(handle)
      await runRepo.update(runId, { stats: JSON.stringify(state.stats), log: JSON.stringify(state.log.slice(-200)) })
    }
    const state = getRunState(handle)
    const finalStatus = handle.isDone() ? 'completed' : 'failed'
    await runRepo.update(runId, {
      status: finalStatus,
      completed_at: new Date().toISOString(),
      stats: JSON.stringify(state.stats),
      log: JSON.stringify(state.log.slice(-200)),
    })
    activeRuns.delete(runId)
  })()

  return c.json({ runId, status: 'running' })
})

pipelinesRouter.post('/runs/:runId/cancel', (c) => {
  const handle = activeRuns.get(c.req.param('runId'))
  if (handle) handle.cancel()
  return c.json({ success: true })
})

pipelinesRouter.post('/runs/:runId/pause', (c) => {
  const handle = activeRuns.get(c.req.param('runId'))
  if (handle) handle.pause()
  return c.json({ success: true })
})

pipelinesRouter.post('/runs/:runId/resume', (c) => {
  const handle = activeRuns.get(c.req.param('runId'))
  if (handle) handle.resume()
  return c.json({ success: true })
})

pipelinesRouter.get('/runs/:runId', async (c) => {
  const runId = c.req.param('runId')
  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  const row = await runRepo.findOneBy({ id: runId, org_id: getTenantId() })
  if (!row) return c.json({ error: 'Run not found' }, 404)

  // If still active, get live stats
  const handle = activeRuns.get(runId)
  let liveStats = row.stats ? JSON.parse(row.stats) : {}
  let liveLog = row.log ? JSON.parse(row.log) : []
  let liveStatus = row.status
  if (handle) {
    const state = getRunState(handle)
    liveStats = state.stats
    liveLog = state.log.slice(-200)
    liveStatus = handle.isDone() ? 'completed' : 'running'
  }

  return c.json({
    id: row.id,
    pipeline_id: row.pipeline_id,
    status: liveStatus,
    started_at: row.started_at,
    completed_at: row.completed_at,
    input: row.input ? JSON.parse(row.input) : {},
    stats: liveStats,
    log: liveLog,
    error: row.error,
  })
})

pipelinesRouter.get('/:id/runs', async (c) => {
  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  const rows = await runRepo.find({
    where: { pipeline_id: c.req.param('id'), org_id: getTenantId() },
    order: { started_at: 'DESC' },
    take: 50,
  })
  return c.json({
    runs: rows.map(r => ({
      id: r.id,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      error: r.error,
    })),
  })
})

// ─── Helpers ─────────────────────────────────────────────────────

function rowToDefinition(row: PipelineDefinitionEntity): PipelineDefinition {
  const graph = JSON.parse(row.graph) as { nodes: PipelineNode[]; edges: NodeEdge[] }
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    description: row.description ?? undefined,
    collection: row.collection,
    status: row.status as PipelineDefinition['status'],
    nodes: graph.nodes,
    edges: graph.edges,
    trigger: row.trigger ? JSON.parse(row.trigger) : undefined,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
