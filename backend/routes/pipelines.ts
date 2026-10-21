// backend/routes/pipelines.ts
// CRUD + run for pipeline definitions. Exposes node-type palette + collections.

import { Hono } from 'hono'
import { getDataSource } from '../db'
import { PipelineDefinitionEntity } from '../db/entities/PipelineDefinitionEntity'
import { PipelineRunEntity } from '../db/entities/PipelineRunEntity'
import { getAllNodeTypes } from '../engine/registry'
import { executePipeline, getRunState, isScraperNodeType, type RunHandle } from '../engine/graph'
import { registerBuiltInNodes } from '../nodes'
import { loadAndRegisterCustomNodes } from '../engine/custom-nodes'
import { getAllPlugins } from '../../plugins/registry'
import { randomUUID } from 'crypto'
import { getTenantId, getCurrentUserId, canViewAllData, getCurrentUserRole, isRoleBelow, canViewPipelines, canRunPipelines, canEditPipelines } from '../db/queries/tenant'
import { getProxyConfigForPipeline } from '../db/queries/proxy-configs.queries'
import type { PipelineDefinition, PipelineNode, NodeEdge } from '../../shared/types/pipeline.types'

export const pipelinesRouter = new Hono()

// Ensure node types and custom user-made nodes are registered on first use
let _nodesRegistered = false
async function ensureNodes() {
  if (!_nodesRegistered) {
    registerBuiltInNodes()
    await loadAndRegisterCustomNodes()
    _nodesRegistered = true
  }
}

// ─── Node type palette ───────────────────────────────────────────

pipelinesRouter.get('/node-types', async (c) => {
  await ensureNodes()
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

// ─── Templates Gallery ───────────────────────────────────────────

pipelinesRouter.get('/templates', async (c) => {
  const { PIPELINE_TEMPLATES } = await import('../templates/pipeline-templates')
  return c.json({ templates: PIPELINE_TEMPLATES })
})

pipelinesRouter.post('/templates/:templateId/instantiate', async (c) => {
  if (!canEditPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to instantiate pipeline templates' }, 403)
  }
  const { PIPELINE_TEMPLATES } = await import('../templates/pipeline-templates')
  const templateId = c.req.param('templateId')
  const tpl = PIPELINE_TEMPLATES.find(t => t.id === templateId)
  if (!tpl) return c.json({ error: 'Template not found' }, 404)

  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const id = randomUUID()
  const now = new Date().toISOString()
  const graph = { nodes: tpl.definition.nodes || [], edges: tpl.definition.edges || [] }

  const row = repo.create({
    id,
    org_id: getTenantId(),
    name: tpl.definition.name,
    description: tpl.definition.description || null,
    collection: tpl.definition.collection || 'leads',
    status: 'draft',
    graph: JSON.stringify(graph),
    trigger: tpl.definition.trigger ? JSON.stringify(tpl.definition.trigger) : null,
    proxy_id: tpl.definition.proxy_id ?? null,
    min_role: tpl.definition.min_role || 'user',
    role_gates: tpl.definition.role_gates ? JSON.stringify(tpl.definition.role_gates) : null,
    version: 1,
    created_at: now,
    updated_at: now,
  })
  await repo.save(row)
  return c.json(rowToDefinition(row), 201)
})

// ─── Pipeline CRUD ───────────────────────────────────────────────

pipelinesRouter.get('/', async (c) => {
  if (!canViewPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to view pipelines' }, 403)
  }
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const rows = await repo.find({ where: { org_id: getTenantId() }, order: { updated_at: 'DESC' } })
  return c.json({
    pipelines: rows.map(rowToDefinition),
  })
})

pipelinesRouter.get('/:id', async (c) => {
  if (!canViewPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to view pipeline' }, 403)
  }
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const row = await repo.findOneBy({ id: c.req.param('id'), org_id: getTenantId() })
  if (!row) return c.json({ error: 'Pipeline not found' }, 404)
  return c.json(rowToDefinition(row))
})

pipelinesRouter.post('/', async (c) => {
  if (!canEditPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to create pipelines' }, 403)
  }
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
    proxy_id: body.proxy_id ?? null,
    min_role: body.min_role || 'user',
    role_gates: body.role_gates ? JSON.stringify(body.role_gates) : null,
    version: 1,
    created_at: now,
    updated_at: now,
  })
  await repo.save(row)
  return c.json(rowToDefinition(row), 201)
})

pipelinesRouter.put('/:id', async (c) => {
  if (!canEditPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to edit pipelines' }, 403)
  }
  const id = c.req.param('id')
  const body = await c.req.json()
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const existing = await repo.findOneBy({ id, org_id: getTenantId() })
  if (!existing) return c.json({ error: 'Pipeline not found' }, 404)

  if (body.name !== undefined) existing.name = body.name
  if (body.description !== undefined) existing.description = body.description
  if (body.collection !== undefined) existing.collection = body.collection
  if (body.status !== undefined) existing.status = body.status
  if (body.proxy_id !== undefined) existing.proxy_id = body.proxy_id
  if (body.min_role !== undefined) existing.min_role = body.min_role
  if (body.role_gates !== undefined) existing.role_gates = body.role_gates ? JSON.stringify(body.role_gates) : null
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
  if (!canEditPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to delete pipelines' }, 403)
  }
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  await repo.delete({ id: c.req.param('id'), org_id: getTenantId() })
  return c.json({ success: true })
})

// ─── Run pipeline ────────────────────────────────────────────────

const activeRuns = new Map<string, RunHandle>()

pipelinesRouter.post('/:id/run', async (c) => {
  if (!canRunPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to run pipelines' }, 403)
  }
  await ensureNodes()
  const id = c.req.param('id')
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const row = await repo.findOneBy({ id, org_id: getTenantId() })
  if (!row) return c.json({ error: 'Pipeline not found' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const input = body.input || {}
  const target: string = body.target || 'local'

  // Role gate: check if user's role is sufficient to run this pipeline
  if (isRoleBelow(row.min_role || 'user')) {
    return c.json({ error: `Insufficient role. Pipeline requires ${row.min_role}, you have ${getCurrentUserRole()}.` }, 403)
  }

  const def = rowToDefinition(row)
  const runId = randomUUID()
  const now = new Date().toISOString()
  const userRole = getCurrentUserRole()
  const tenantId = getTenantId()

  // Resolve proxy config for this pipeline (null if no proxy set)
  const proxyConfig = await getProxyConfigForPipeline(row.proxy_id)

  // If target is farm_auto or specific worker, dispatch to desktop farm
  if (target === 'farm_auto' || target.startsWith('worker:')) {
    try {
      const { workerHub } = require('../../server/src/ws/worker-hub')
      const targetWorkerId = target === 'farm_auto' ? undefined : target.replace('worker:', '')
      const dispatchResult = await workerHub.dispatchPipeline(tenantId, {
        runId,
        pipeline: def,
        input,
        targetWorkerId,
        proxyConfig: proxyConfig ? {
          server: proxyConfig.server,
          port: proxyConfig.port,
          username: proxyConfig.username,
          password: proxyConfig.password,
          type: proxyConfig.type as 'http' | 'https' | 'socks5',
        } : null,
      })

      if (dispatchResult.dispatched) {
        const runRepo = getDataSource().getRepository(PipelineRunEntity)
        await runRepo.save(runRepo.create({
          id: runId,
          pipeline_id: id,
          org_id: tenantId,
          created_by_user_id: getCurrentUserId(),
          status: 'running',
          started_at: now,
          input: JSON.stringify(input),
          stats: JSON.stringify({ workerId: dispatchResult.workerId, workerName: dispatchResult.workerName }),
          log: '[]',
        }))

        return c.json({
          runId,
          status: 'running',
          execution_target: 'farm',
          workerId: dispatchResult.workerId,
          workerName: dispatchResult.workerName,
        })
      } else {
        return c.json({ error: dispatchResult.error || 'Failed to dispatch to desktop worker farm.' }, 400)
      }
    } catch (err: any) {
      console.warn('[pipelines/run] Farm dispatch failed, err:', err?.message || err)
      return c.json({ error: `Farm dispatch error: ${err?.message || err}` }, 500)
    }
  }

  // Enforce BYO-Proxy rule for server-side scraping:
  // Server-side scraper runs must have a user-provided proxy configured to prevent datacenter IP blocking.
  const hasScraperNode = def.nodes.some(n => isScraperNodeType(n.type))
  if (hasScraperNode && !proxyConfig) {
    return c.json({
      error: 'Server-side scraping requires a proxy configuration to prevent datacenter IP blocking. Please assign a proxy to this pipeline in Settings or run via Desktop Worker.',
      code: 'PROXY_REQUIRED_FOR_SCRAPER',
      pipelineId: id,
    }, 400)
  }

  // Persist run record
  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  await runRepo.save(runRepo.create({
    id: runId,
    pipeline_id: id,
    org_id: tenantId,
    created_by_user_id: getCurrentUserId(),
    status: 'running',
    started_at: now,
    input: JSON.stringify(input),
    stats: '{}',
    log: '[]',
  }))

  const handle = await executePipeline(def, {
    runId,
    input,
    userRole,
    proxyConfig: proxyConfig ? {
      server: proxyConfig.server,
      port: proxyConfig.port,
      username: proxyConfig.username,
      password: proxyConfig.password,
      type: proxyConfig.type as 'http' | 'https' | 'socks5',
    } : null,
    onProgress: (msg) => {
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
      await runRepo.update(runId, {
        stats: JSON.stringify(state.stats),
        log: JSON.stringify(state.log.slice(-200)),
        snapshots: JSON.stringify(state.snapshots || {}),
      })
    }
    const state = getRunState(handle)
    const finalStatus = handle.isDone() ? 'completed' : 'failed'
    await runRepo.update(runId, {
      status: finalStatus,
      completed_at: new Date().toISOString(),
      stats: JSON.stringify(state.stats),
      log: JSON.stringify(state.log.slice(-200)),
      snapshots: JSON.stringify(state.snapshots || {}),
    })
    activeRuns.delete(runId)
  })()

  return c.json({ runId, status: 'running' })
})

pipelinesRouter.post('/runs/:runId/replay', async (c) => {
  if (!canRunPipelines()) {
    return c.json({ error: 'Forbidden: Insufficient permissions to replay pipelines' }, 403)
  }
  await ensureNodes()
  const runId = c.req.param('runId')
  const body = await c.req.json().catch(() => ({}))
  const fromNodeId = body.fromNodeId
  if (!fromNodeId) {
    return c.json({ error: 'fromNodeId is required for replay' }, 400)
  }

  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  const origRun = await runRepo.findOneBy({ id: runId, org_id: getTenantId() })
  if (!origRun) return c.json({ error: 'Original run not found' }, 404)

  const pipeRepo = getDataSource().getRepository(PipelineDefinitionEntity)
  const pipeRow = await pipeRepo.findOneBy({ id: origRun.pipeline_id, org_id: getTenantId() })
  if (!pipeRow) return c.json({ error: 'Pipeline definition not found' }, 404)

  const def = rowToDefinition(pipeRow)
  const newRunId = randomUUID()
  const now = new Date().toISOString()
  const userRole = getCurrentUserRole()
  const tenantId = getTenantId()

  // Extract snapshot input payloads for fromNodeId
  const parsedSnapshots = origRun.snapshots ? JSON.parse(origRun.snapshots) : {}
  const nodeSnapshot = parsedSnapshots[fromNodeId]
  const seedPayloads: any[] = nodeSnapshot?.inputs || []

  // Wrap payloads into PipelineRecord format
  const seedRecords = seedPayloads.map((data, idx) => ({
    id: `replay-${idx}-${Date.now()}`,
    collection: def.collection,
    data,
    meta: {
      pipelineId: def.id,
      runId: newRunId,
      sourceNodeId: fromNodeId,
      orgId: tenantId,
      createdAt: now,
      trace: [fromNodeId],
    },
  }))

  const proxyConfig = await getProxyConfigForPipeline(pipeRow.proxy_id)

  const hasScraperNode = def.nodes.some(n => isScraperNodeType(n.type))
  if (hasScraperNode && !proxyConfig) {
    return c.json({
      error: 'Server-side scraping requires a proxy configuration to prevent datacenter IP blocking. Please assign a proxy to this pipeline in Settings or run via Desktop Worker.',
      code: 'PROXY_REQUIRED_FOR_SCRAPER',
      pipelineId: def.id,
    }, 400)
  }

  await runRepo.save(runRepo.create({
    id: newRunId,
    pipeline_id: def.id,
    org_id: tenantId,
    created_by_user_id: getCurrentUserId(),
    status: 'running',
    started_at: now,
    input: JSON.stringify({ replay_of: runId, from_node: fromNodeId }),
    stats: '{}',
    log: '[]',
  }))

  const handle = await executePipeline(def, {
    runId: newRunId,
    replayFromNodeId: fromNodeId,
    seedRecords,
    userRole,
    proxyConfig: proxyConfig ? {
      server: proxyConfig.server,
      port: proxyConfig.port,
      username: proxyConfig.username,
      password: proxyConfig.password,
      type: proxyConfig.type as 'http' | 'https' | 'socks5',
    } : null,
  })
  activeRuns.set(newRunId, handle)

  ;(async () => {
    const maxWait = 60 * 60 * 1000
    const start = Date.now()
    while (!handle.isDone() && Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 2000))
      const state = getRunState(handle)
      await runRepo.update(newRunId, {
        stats: JSON.stringify(state.stats),
        log: JSON.stringify(state.log.slice(-200)),
        snapshots: JSON.stringify(state.snapshots || {}),
      })
    }
    const state = getRunState(handle)
    const finalStatus = handle.isDone() ? 'completed' : 'failed'
    await runRepo.update(newRunId, {
      status: finalStatus,
      completed_at: new Date().toISOString(),
      stats: JSON.stringify(state.stats),
      log: JSON.stringify(state.log.slice(-200)),
      snapshots: JSON.stringify(state.snapshots || {}),
    })
    activeRuns.delete(newRunId)
  })()

  return c.json({ runId: newRunId, status: 'running', replayOf: runId, fromNodeId })
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
  const where: any = { id: runId, org_id: getTenantId() }
  if (!canViewAllData()) {
    where.created_by_user_id = getCurrentUserId()
  }
  const row = await runRepo.findOneBy(where)
  if (!row) return c.json({ error: 'Run not found' }, 404)

  // If still active, get live stats
  const handle = activeRuns.get(runId)
  let liveStats = row.stats ? JSON.parse(row.stats) : {}
  let liveLog = row.log ? JSON.parse(row.log) : []
  let liveSnapshots = row.snapshots ? JSON.parse(row.snapshots) : {}
  let liveStatus = row.status
  if (handle) {
    const state = getRunState(handle)
    liveStats = state.stats
    liveLog = state.log.slice(-200)
    liveSnapshots = state.snapshots || {}
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
    error: row.error,
    log: liveLog,
    snapshots: liveSnapshots,
  })
})

// ─── Webhook ingestion ───────────────────────────────────────────
// POST /api/pipelines/webhook/:slug — triggers any pipeline whose
// trigger node has type='webhook' and webhook_slug matching :slug.

pipelinesRouter.post('/webhook/:slug', async (c) => {
  ensureNodes()
  const slug = c.req.param('slug')
  const body = await c.req.json().catch(() => ({}))

  // Find all active pipelines with a matching webhook trigger node
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const all = await repo.find({ where: { status: 'active' } })

  const matching = all.filter(row => {
    try {
      const graph = JSON.parse(row.graph) as { nodes: Array<{ type: string; config: Record<string, unknown> }> }
      return graph.nodes.some(
        n => n.type === 'trigger' && n.config.type === 'webhook' && n.config.webhook_slug === slug
      )
    } catch { return false }
  })

  if (matching.length === 0) {
    return c.json({ error: `No active pipeline found for webhook slug '${slug}'` }, 404)
  }

  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  const fired: string[] = []

  for (const row of matching) {
    const def = rowToDefinition(row)
    const runId = randomUUID()
    const now = new Date().toISOString()

    const proxyConfig = await getProxyConfigForPipeline(row.proxy_id)
    const hasScraperNode = def.nodes.some(n => isScraperNodeType(n.type))
    if (hasScraperNode && !proxyConfig) {
      console.warn(`[webhook ${slug}] Skipped pipeline '${row.name}' — server scraping requires configured proxy`)
      continue
    }

    await runRepo.save(runRepo.create({
      id: runId,
      pipeline_id: row.id,
      org_id: row.org_id,
      created_by_user_id: null,
      status: 'running',
      started_at: now,
      input: JSON.stringify(body),
      stats: '{}',
      log: '[]',
    }))

    const handle = await executePipeline(def, {
      runId,
      input: body,
      userRole: 'system',
      proxyConfig: proxyConfig ? {
        server: proxyConfig.server,
        port: proxyConfig.port,
        username: proxyConfig.username,
        password: proxyConfig.password,
        type: proxyConfig.type as 'http' | 'https' | 'socks5',
      } : null,
      onProgress: msg => console.log(`[webhook ${slug}] ${msg.nodeId ?? ''}: ${msg.message}`),
    })
    activeRuns.set(runId, handle)

    // Background persist on completion
    ;(async () => {
      while (!handle.isDone()) await new Promise(r => setTimeout(r, 2000))
      const state = getRunState(handle)
      await runRepo.update(runId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        stats: JSON.stringify(state.stats),
        log: JSON.stringify(state.log.slice(-200)),
      })
      activeRuns.delete(runId)
    })()

    fired.push(runId)
  }

  return c.json({ accepted: true, runIds: fired }, 202)
})

// ─── Duplicate pipeline ───────────────────────────────────────────

pipelinesRouter.post('/:id/duplicate', async (c) => {
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  const existing = await repo.findOneBy({ id: c.req.param('id'), org_id: getTenantId() })
  if (!existing) return c.json({ error: 'Pipeline not found' }, 404)

  const now = new Date().toISOString()
  const newId = randomUUID()
  const copy = repo.create({
    ...existing,
    id: newId,
    name: `${existing.name} (copy)`,
    status: 'draft',
    created_at: now,
    updated_at: now,
  })
  await repo.save(copy)
  return c.json(rowToDefinition(copy), 201)
})

pipelinesRouter.get('/:id/runs', async (c) => {
  const runRepo = getDataSource().getRepository(PipelineRunEntity)
  const where: any = { pipeline_id: c.req.param('id'), org_id: getTenantId() }
  if (!canViewAllData()) {
    where.created_by_user_id = getCurrentUserId()
  }
  const rows = await runRepo.find({
    where,
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
    proxy_id: row.proxy_id,
    min_role: row.min_role || 'user',
    role_gates: row.role_gates ? JSON.parse(row.role_gates) : null,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
