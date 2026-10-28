import type { RequestContext } from 'katal'
import { getDataSource } from '../../db'
import { PipelineDefinitionEntity } from '../../db/entities/PipelineDefinitionEntity'
import { PipelineRunEntity } from '../../db/entities/PipelineRunEntity'
import { getAllNodeTypes } from '@sdk/core/engine/registry'
import { executePipeline, getRunState, isScraperNodeType, type RunHandle } from '@sdk/core/engine/graph'
import { registerBuiltInNodes } from '@sdk/core/nodes'
import { loadAndRegisterCustomNodes } from '../../core/engine/custom-nodes'
import { getAllPlugins } from '@sdk/plugins/registry'
import { randomUUID } from 'crypto'
import {
  getTenantId,
  getCurrentUserId,
  canViewAllData,
  getCurrentUserRole,
  isRoleBelow,
  canViewPipelines,
  canRunPipelines,
  canEditPipelines,
} from '../../db/queries/tenant'
import { getProxyConfigForPipeline } from '../../db/queries/proxy-configs.queries'
import { sendError, HttpStatus } from '../../common'
import type { PipelineDefinition, PipelineNode, NodeEdge, PipelineStatus } from '@sdk/core/types'
import type { FindOptionsWhere } from 'typeorm'

let _nodesRegistered = false
async function ensureNodes() {
  if (!_nodesRegistered) {
    registerBuiltInNodes()
    await loadAndRegisterCustomNodes()
    _nodesRegistered = true
  }
}

export function rowToDefinition(row: PipelineDefinitionEntity): PipelineDefinition {
  let graph: { nodes: PipelineNode[]; edges: NodeEdge[] } = { nodes: [], edges: [] }
  try {
    graph = JSON.parse(row.graph || '{"nodes":[],"edges":[]}')
  } catch {}

  let trigger = undefined
  if (row.trigger) {
    try {
      trigger = JSON.parse(row.trigger)
    } catch {}
  }

  let roleGates = undefined
  if (row.role_gates) {
    try {
      roleGates = JSON.parse(row.role_gates)
    } catch {}
  }

  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    description: row.description ?? undefined,
    collection: row.collection,
    status: row.status as PipelineStatus,
    nodes: graph.nodes || [],
    edges: graph.edges || [],
    trigger,
    proxy_id: row.proxy_id ?? undefined,
    min_role: row.min_role || 'user',
    role_gates: roleGates,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

const activeRuns = new Map<string, RunHandle>()

export class PipelineController {
  /**
   * GET /api/pipelines/node-types
   */
  static async getNodeTypes(c: RequestContext): Promise<Response> {
    try {
      await ensureNodes()
      const types = getAllNodeTypes()
      const plugins = getAllPlugins()
      const enriched = types.map((t) => {
        if (t.type === 'scraper' || t.type === 'enricher' || t.type === 'connector') {
          const kind = t.type === 'scraper' ? 'scraper' : t.type === 'enricher' ? 'enricher' : 'connector'
          const pluginOptions = plugins.filter((p) => p.manifest.kind === kind).map((p) => p.manifest.id)
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
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/pipelines/templates
   */
  static async getTemplates(c: RequestContext): Promise<Response> {
    try {
      const { PIPELINE_TEMPLATES } = await import('../../core/templates/pipeline-templates')
      return c.json({ templates: PIPELINE_TEMPLATES })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines/templates/:templateId/instantiate
   */
  static async instantiateTemplate(c: RequestContext): Promise<Response> {
    try {
      if (!canEditPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to instantiate pipeline templates' }, 403)
      }
      const { PIPELINE_TEMPLATES } = await import('../../core/templates/pipeline-templates')
      const templateId = (c.params?.templateId || c.req.param('templateId') || '') as string
      const tpl = PIPELINE_TEMPLATES.find((t) => t.id === templateId)
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
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/pipelines
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      if (!canViewPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to view pipelines' }, 403)
      }
      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const rows = await repo.find({ where: { org_id: getTenantId() }, order: { updated_at: 'DESC' } })
      return c.json({
        pipelines: rows.map(rowToDefinition),
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/pipelines/:id
   */
  static async getById(c: RequestContext): Promise<Response> {
    try {
      if (!canViewPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to view pipeline' }, 403)
      }
      const id = (c.params?.id || c.req.param('id') || '') as string
      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const row = await repo.findOneBy({ id, org_id: getTenantId() })
      if (!row) return c.json({ error: 'Pipeline not found' }, 404)
      return c.json(rowToDefinition(row))
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
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
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * PUT /api/pipelines/:id
   */
  static async update(c: RequestContext): Promise<Response> {
    try {
      if (!canEditPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to edit pipelines' }, 403)
      }
      const id = (c.params?.id || c.req.param('id') || '') as string
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
        const current = JSON.parse(existing.graph || '{"nodes":[],"edges":[]}')
        existing.graph = JSON.stringify({
          nodes: body.nodes ?? current.nodes,
          edges: body.edges ?? current.edges,
        })
      }
      if (body.trigger !== undefined) existing.trigger = body.trigger ? JSON.stringify(body.trigger) : null
      existing.updated_at = new Date().toISOString()

      await repo.save(existing)
      return c.json(rowToDefinition(existing))
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/pipelines/:id
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      if (!canEditPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to delete pipelines' }, 403)
      }
      const id = (c.params?.id || c.req.param('id') || '') as string
      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const existing = await repo.findOneBy({ id, org_id: getTenantId() })
      if (!existing) return c.json({ error: 'Pipeline not found' }, 404)

      await repo.delete({ id, org_id: getTenantId() })
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines/:id/run
   */
  static async run(c: RequestContext): Promise<Response> {
    try {
      if (!canRunPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to run pipelines' }, 403)
      }
      await ensureNodes()
      const id = (c.params?.id || c.req.param('id') || '') as string
      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const row = await repo.findOneBy({ id, org_id: getTenantId() })
      if (!row) return c.json({ error: 'Pipeline not found' }, 404)

      const body = (await c.req.json().catch(() => ({}))) || {}
      const input = body.input || {}
      const target: string = body.target || 'local'

      if (isRoleBelow(row.min_role || 'user')) {
        return c.json({ error: `Insufficient role. Pipeline requires ${row.min_role}, you have ${getCurrentUserRole()}.` }, 403)
      }

      const def = rowToDefinition(row)
      const runId = randomUUID()
      const now = new Date().toISOString()
      const userRole = getCurrentUserRole()
      const tenantId = getTenantId()

      const proxyConfig = await getProxyConfigForPipeline(row.proxy_id)

      if (target === 'farm_auto' || target.startsWith('worker:')) {
        try {
          const { workerHub } = await import('../../ws/worker-hub')
          const targetWorkerId = target === 'farm_auto' ? undefined : target.replace('worker:', '')
          const dispatchResult = await workerHub.dispatchPipeline(tenantId, {
            runId,
            pipeline: def as unknown as Record<string, unknown>,
            input,
            targetWorkerId,
            proxyConfig: proxyConfig
              ? {
                  server: proxyConfig.server,
                  port: proxyConfig.port,
                  username: proxyConfig.username,
                  password: proxyConfig.password,
                  type: proxyConfig.type as 'http' | 'https' | 'socks5',
                }
              : undefined,
          })

          if (dispatchResult.dispatched) {
            const runRepo = getDataSource().getRepository(PipelineRunEntity)
            await runRepo.save(
              runRepo.create({
                id: runId,
                pipeline_id: id,
                org_id: tenantId,
                created_by_user_id: getCurrentUserId() ?? null,
                status: 'running',
                started_at: now,
                input: JSON.stringify(input),
                stats: JSON.stringify({ workerId: dispatchResult.workerId, workerName: dispatchResult.workerName }),
                log: '[]',
              })
            )

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
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          return c.json({ error: `Farm dispatch error: ${errMsg}` }, 500)
        }
      }

      const hasScraperNode = def.nodes.some((n) => isScraperNodeType(n.type))
      if (hasScraperNode && !proxyConfig) {
        return c.json(
          {
            error:
              'Server-side scraping requires a proxy configuration to prevent datacenter IP blocking. Please assign a proxy to this pipeline in Settings or run via Desktop Worker.',
            code: 'PROXY_REQUIRED_FOR_SCRAPER',
            pipelineId: id,
          },
          400
        )
      }

      const runRepo = getDataSource().getRepository(PipelineRunEntity)
      await runRepo.save(
        runRepo.create({
          id: runId,
          pipeline_id: id,
          org_id: tenantId,
          created_by_user_id: getCurrentUserId() ?? null,
          status: 'running',
          started_at: now,
          input: JSON.stringify(input),
          stats: '{}',
          log: '[]',
        })
      )

      const handle = await executePipeline(def, {
        runId,
        input,
        userRole,
        proxyConfig: proxyConfig
          ? {
              server: proxyConfig.server,
              port: proxyConfig.port,
              username: proxyConfig.username,
              password: proxyConfig.password,
              type: proxyConfig.type as 'http' | 'https' | 'socks5',
            }
          : null,
        onProgress: (msg) => {
          console.log(`[pipeline ${runId}] ${msg.nodeId ?? ''}: ${msg.message}`)
        },
      })
      activeRuns.set(runId, handle)

      ;(async () => {
        const maxWait = 60 * 60 * 1000
        const start = Date.now()
        while (!handle.isDone() && Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, 2000))
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
      })().catch(console.error)

      return c.json({ runId, status: 'running' })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines/runs/:runId/replay
   */
  static async replayRun(c: RequestContext): Promise<Response> {
    try {
      if (!canRunPipelines()) {
        return c.json({ error: 'Forbidden: Insufficient permissions to replay pipelines' }, 403)
      }
      await ensureNodes()
      const runId = (c.params?.runId || c.req.param('runId') || '') as string
      const body = (await c.req.json().catch(() => ({}))) || {}
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

      const parsedSnapshots = origRun.snapshots ? JSON.parse(origRun.snapshots) : {}
      const nodeSnapshot = parsedSnapshots[fromNodeId]
      const seedPayloads: Array<Record<string, unknown>> = nodeSnapshot?.inputs || []

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
      const hasScraperNode = def.nodes.some((n) => isScraperNodeType(n.type))
      if (hasScraperNode && !proxyConfig) {
        return c.json(
          {
            error:
              'Server-side scraping requires a proxy configuration to prevent datacenter IP blocking. Please assign a proxy to this pipeline in Settings or run via Desktop Worker.',
            code: 'PROXY_REQUIRED_FOR_SCRAPER',
            pipelineId: def.id,
          },
          400
        )
      }

      await runRepo.save(
        runRepo.create({
          id: newRunId,
          pipeline_id: def.id,
          org_id: tenantId,
          created_by_user_id: getCurrentUserId() ?? null,
          status: 'running',
          started_at: now,
          input: JSON.stringify({ replay_of: runId, from_node: fromNodeId }),
          stats: '{}',
          log: '[]',
        })
      )

      const handle = await executePipeline(def, {
        runId: newRunId,
        replayFromNodeId: fromNodeId,
        seedRecords,
        userRole,
        proxyConfig: proxyConfig
          ? {
              server: proxyConfig.server,
              port: proxyConfig.port,
              username: proxyConfig.username,
              password: proxyConfig.password,
              type: proxyConfig.type as 'http' | 'https' | 'socks5',
            }
          : null,
      })
      activeRuns.set(newRunId, handle)

      ;(async () => {
        const maxWait = 60 * 60 * 1000
        const start = Date.now()
        while (!handle.isDone() && Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, 2000))
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
      })().catch(console.error)

      return c.json({ runId: newRunId, status: 'running', replayOf: runId, fromNodeId })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines/runs/:runId/cancel
   */
  static async cancelRun(c: RequestContext): Promise<Response> {
    const runId = (c.params?.runId || c.req.param('runId') || '') as string
    const handle = activeRuns.get(runId)
    if (handle) handle.cancel()
    return c.json({ success: true })
  }

  /**
   * POST /api/pipelines/runs/:runId/pause
   */
  static async pauseRun(c: RequestContext): Promise<Response> {
    const runId = (c.params?.runId || c.req.param('runId') || '') as string
    const handle = activeRuns.get(runId)
    if (handle) handle.pause()
    return c.json({ success: true })
  }

  /**
   * POST /api/pipelines/runs/:runId/resume
   */
  static async resumeRun(c: RequestContext): Promise<Response> {
    const runId = (c.params?.runId || c.req.param('runId') || '') as string
    const handle = activeRuns.get(runId)
    if (handle) handle.resume()
    return c.json({ success: true })
  }

  /**
   * GET /api/pipelines/runs/:runId
   */
  static async getRun(c: RequestContext): Promise<Response> {
    try {
      const runId = (c.params?.runId || c.req.param('runId') || '') as string
      const runRepo = getDataSource().getRepository(PipelineRunEntity)
      const where: FindOptionsWhere<PipelineRunEntity> = { id: runId, org_id: getTenantId() }
      if (!canViewAllData()) {
        where.created_by_user_id = getCurrentUserId() ?? undefined
      }
      const row = await runRepo.findOneBy(where)
      if (!row) return c.json({ error: 'Run not found' }, 404)

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
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines/webhook/:slug
   */
  static async triggerWebhook(c: RequestContext): Promise<Response> {
    try {
      await ensureNodes()
      const slug = (c.params?.slug || c.req.param('slug') || '') as string
      const body = (await c.req.json().catch(() => ({}))) || {}

      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const all = await repo.find({ where: { status: 'active' } })

      const matching = all.filter((row) => {
        try {
          const graph = JSON.parse(row.graph) as { nodes: Array<{ type: string; config: Record<string, unknown> }> }
          return graph.nodes.some(
            (n) => n.type === 'trigger' && n.config.type === 'webhook' && n.config.webhook_slug === slug
          )
        } catch {
          return false
        }
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
        const hasScraperNode = def.nodes.some((n) => isScraperNodeType(n.type))
        if (hasScraperNode && !proxyConfig) {
          console.warn(`[webhook ${slug}] Skipped pipeline '${row.name}' — server scraping requires configured proxy`)
          continue
        }

        await runRepo.save(
          runRepo.create({
            id: runId,
            pipeline_id: row.id,
            org_id: row.org_id,
            created_by_user_id: null,
            status: 'running',
            started_at: now,
            input: JSON.stringify(body),
            stats: '{}',
            log: '[]',
          })
        )

        const handle = await executePipeline(def, {
          runId,
          input: body,
          userRole: 'system',
          proxyConfig: proxyConfig
            ? {
                server: proxyConfig.server,
                port: proxyConfig.port,
                username: proxyConfig.username,
                password: proxyConfig.password,
                type: proxyConfig.type as 'http' | 'https' | 'socks5',
              }
            : null,
          onProgress: (msg) => console.log(`[webhook ${slug}] ${msg.nodeId ?? ''}: ${msg.message}`),
        })
        activeRuns.set(runId, handle)

        ;(async () => {
          while (!handle.isDone()) await new Promise((r) => setTimeout(r, 2000))
          const state = getRunState(handle)
          await runRepo.update(runId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            stats: JSON.stringify(state.stats),
            log: JSON.stringify(state.log.slice(-200)),
          })
          activeRuns.delete(runId)
        })().catch(console.error)

        fired.push(runId)
      }

      return c.json({ accepted: true, runIds: fired }, 202)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/pipelines/:id/duplicate
   */
  static async duplicate(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const repo = getDataSource().getRepository(PipelineDefinitionEntity)
      const existing = await repo.findOneBy({ id, org_id: getTenantId() })
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
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/pipelines/:id/runs
   */
  static async listRuns(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const runRepo = getDataSource().getRepository(PipelineRunEntity)
      const where: FindOptionsWhere<PipelineRunEntity> = { pipeline_id: id, org_id: getTenantId() }
      if (!canViewAllData()) {
        where.created_by_user_id = getCurrentUserId() ?? undefined
      }
      const rows = await runRepo.find({
        where,
        order: { started_at: 'DESC' },
        take: 50,
      })
      return c.json({
        runs: rows.map((r) => ({
          id: r.id,
          status: r.status,
          started_at: r.started_at,
          completed_at: r.completed_at,
          error: r.error,
        })),
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
