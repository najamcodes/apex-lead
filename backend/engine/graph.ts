// backend/engine/graph.ts
// DAG executor: topological traversal + record bus with field mapping.

import type {
  PipelineDefinition,
  PipelineNode,
  NodeEdge,
  PipelineRecord,
  FieldMapping,
} from '../../shared/types/pipeline.types'
import { getNodeHandler } from './registry'
import type { NodeExecutionContext, RunStatsMap, RunLog, RunSnapshotMap } from './types'
import { randomUUID } from 'crypto'

// ─────────────────────────────────────────────────────────────────
// Helpers — value extraction & mapping
// ─────────────────────────────────────────────────────────────────

/** Read a dot-path from an object, e.g. get("address.city", obj). Returns undefined if missing. */
export function getPath(path: string, obj: Record<string, unknown> | undefined): unknown {
  if (!obj) return undefined
  if (!path.includes('.')) return obj[path]
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

/**
 * Apply a transform expression to a value.
 * Supports:
 *   - Template strings with {{source}}: "Hello {{value}}" → string substitution
 *   - Expression form "value * 2", "value.toUpperCase()": evaluated against `value`
 * Falls back to the raw value if transform fails.
 */
export function applyTransform(value: unknown, transform: string): unknown {
  if (value === undefined || value === null) return value
  // Template form: contains {{...}}
  if (transform.includes('{{')) {
    return transform.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
      const trimmed = expr.trim()
      if (trimmed === 'value' || trimmed === 'source') return String(value)
      // Allow nested paths against the value if it's an object
      const sub = getPath(trimmed, value as Record<string, unknown>)
      return sub !== undefined ? String(sub) : ''
    })
  }
  // Expression form: operate on `value`
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('value', `'use strict'; return (${transform})`)
    return fn(value)
  } catch {
    return value
  }
}

/** Apply an array of field mappings to a source record's data, producing the destination's input. */
export function applyMappings(
  mappings: FieldMapping[] | undefined,
  sourceData: Record<string, unknown>,
): Record<string, unknown> {
  if (!mappings || mappings.length === 0) {
    // Pass-through: copy everything
    return { ...sourceData }
  }
  const out: Record<string, unknown> = {}
  for (const m of mappings) {
    let val = getPath(m.source, sourceData)
    if (val === undefined && m.default !== undefined) val = m.default
    if (m.transform) val = applyTransform(val, m.transform)
    out[m.target] = val
  }
  return out
}

/** Evaluate a branch condition expression against a record's data. Default true. */
export function evalCondition(condition: string | undefined, data: Record<string, unknown>): boolean {
  if (!condition) return true
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('data', `'use strict'; return (${condition})`)
    return Boolean(fn(data))
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────
// Graph topology
// ─────────────────────────────────────────────────────────────────

/** Build adjacency: for each node, its incoming edges. */
function buildIncoming(pipeline: PipelineDefinition): Map<string, NodeEdge[]> {
  const map = new Map<string, NodeEdge[]>()
  for (const node of pipeline.nodes) {
    if (!node.enabled) continue
    map.set(node.id, [])
  }
  for (const edge of pipeline.edges) {
    const toNode = pipeline.nodes.find(n => n.id === edge.to)
    const fromNode = pipeline.nodes.find(n => n.id === edge.from)
    if (!toNode || !fromNode || !toNode.enabled || !fromNode.enabled) continue
    map.get(edge.to)!.push(edge)
  }
  return map
}

/** Find start nodes: enabled nodes with no incoming edges. */
function findStartNodes(pipeline: PipelineDefinition): PipelineNode[] {
  const incoming = buildIncoming(pipeline)
  return pipeline.nodes.filter(n => n.enabled && (incoming.get(n.id)?.length ?? 0) === 0)
}

// ─────────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────────

export interface RunHandle {
  runId: string
  cancel: () => void
  pause: () => void
  resume: () => void
  isDone: () => boolean
  /** Live snapshot of per-node stats. */
  getStats: () => RunStatsMap
  /** Live snapshot of the run log (capped). */
  getLog: () => RunLog
  /** Live snapshot of per-node input/output payloads. */
  getSnapshots: () => RunSnapshotMap
}

export interface ExecuteOptions {
  runId?: string
  /** Input config passed to start nodes (e.g. query, city for a manual run). */
  input?: Record<string, unknown>
  /** Replay from a specific intermediate node id instead of root start nodes. */
  replayFromNodeId?: string
  /** Seed records to inject into the replay node's queue. */
  seedRecords?: PipelineRecord[]
  /** Progress callback (for WS broadcast). */
  onProgress?: (msg: { nodeId?: string; level: 'info' | 'warn' | 'error'; message: string }) => void
  /** Record emission callback (for streaming to central backend or listeners). */
  onRecord?: (record: PipelineRecord) => void
  /**
   * Resolved proxy configuration for this pipeline run.
   * Looked up from pipeline.proxy_id before calling executePipeline.
   */
  proxyConfig?: {
    server: string
    port: number
    username?: string | null
    password?: string | null
    type: 'http' | 'https' | 'socks5'
  } | null
  /**
   * Role of the user triggering this run.
   * Used for per-node role gate enforcement.
   */
  userRole?: string
}

/**
 * Execute a pipeline graph.
 * - Walks nodes in dependency order (a node runs once all its upstream edges have delivered records).
 * - Each node receives merged inputs from all incoming edges (field mappings applied per-edge).
 * - Branch edges filter records by condition.
 * - Records flow through an async queue per node.
 */
export async function executePipeline(
  pipeline: PipelineDefinition,
  opts: ExecuteOptions = {},
): Promise<RunHandle> {
  const runId = opts.runId ?? randomUUID()
  const log: RunLog = []
  const stats: RunStatsMap = {}
  const snapshots: RunSnapshotMap = {}
  let cancelled = false
  let paused = false
  let done = false

  // Initialize stats & snapshots structure for all nodes
  for (const node of pipeline.nodes) {
    snapshots[node.id] = { inputs: [], outputs: [] }
  }

  const incoming = buildIncoming(pipeline)
  let startNodes = findStartNodes(pipeline)

  // Support Time-Travel Replay from specific intermediate node
  if (opts.replayFromNodeId) {
    const replayNode = pipeline.nodes.find(n => n.id === opts.replayFromNodeId && n.enabled)
    if (!replayNode) {
      throw new Error(`Replay target node '${opts.replayFromNodeId}' not found or is disabled`)
    }
    startNodes = [replayNode]
  }

  if (startNodes.length === 0) {
    throw new Error('Pipeline has no start nodes (all nodes have inputs or are disabled)')
  }

  // Per-node record queues. A node waits until every incoming edge has delivered
  // at least one batch (or its upstream is exhausted) before executing.
  const queues = new Map<string, PipelineRecord[]>()
  const upstreamDone = new Map<string, Set<string>>() // nodeId -> set of upstream nodeIds done
  for (const node of pipeline.nodes) {
    if (!node.enabled) continue
    queues.set(node.id, [])
    upstreamDone.set(node.id, new Set())
  }

  // If replay seed records are provided, inject into replay node's queue
  if (opts.replayFromNodeId && opts.seedRecords?.length) {
    queues.set(opts.replayFromNodeId, [...opts.seedRecords])
  }

  const logFn = (nodeId: string | undefined, level: 'info' | 'warn' | 'error', message: string) => {
    const entry = { ts: new Date().toISOString(), nodeId, level, message }
    log.push(entry)
    if (log.length > 1000) log.shift()
    opts.onProgress?.({ nodeId, level, message })
  }

  const isCancelled = () => cancelled
  const isPaused = async () => {
    while (paused && !cancelled) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // Recursively run a node once its inputs are ready.
  async function runNode(node: PipelineNode): Promise<void> {
    if (cancelled || !node.enabled) return

    const nodeStartTime = Date.now()

    // Check per-node role gate (from pipeline.role_gates JSON)
    const roleGates = pipeline.role_gates ? (typeof pipeline.role_gates === 'string' ? JSON.parse(pipeline.role_gates as any) : pipeline.role_gates) : {}
    const nodeMinRole = roleGates[node.id]
    if (nodeMinRole) {
      const { roleLevel } = await import('../db/queries/tenant')
      const userRoleLevel = roleLevel(opts.userRole ?? 'user')
      const minRoleLevel = roleLevel(nodeMinRole)
      if (userRoleLevel < minRoleLevel) {
        logFn(node.id, 'info', `Skipping node '${node.label}' (requires role '${nodeMinRole}', user has '${opts.userRole ?? 'user'}')`)
        // Still mark as done so downstreams can proceed
        stats[node.id] ??= { received: 0, produced: 0, errors: 0, started_at: new Date().toISOString(), completed_at: new Date().toISOString() }
        return
      }
    }

    stats[node.id] ??= { received: 0, produced: 0, errors: 0, started_at: new Date().toISOString() }
    const nodeStats = stats[node.id]
    snapshots[node.id] ??= { inputs: [], outputs: [] }

    const incomingEdges = incoming.get(node.id) ?? []
    // Merge inputs from all incoming records (apply per-edge mappings)
    const incomingRecords = queues.get(node.id) ?? []
    nodeStats.received += incomingRecords.length

    // Record up to 25 input record samples for time-travel inspection
    if (incomingRecords.length > 0 && snapshots[node.id].inputs.length < 25) {
      const remainingSlots = 25 - snapshots[node.id].inputs.length
      snapshots[node.id].inputs.push(...incomingRecords.slice(0, remainingSlots).map(r => r.data))
    }

    let mergedInput: Record<string, unknown> = {}
    for (const rec of incomingRecords) {
      // Find the edge that delivered this record to apply its mappings.
      // (We tag each record with the source edge id when enqueueing.)
      const edgeId = (rec.meta as any).__edgeId as string | undefined
      const edge = incomingEdges.find(e => e.id === edgeId)
      const mapped = applyMappings(edge?.mappings, rec.data)
      mergedInput = { ...mergedInput, ...mapped }
    }

    // Strip the internal __edgeId before passing to the node
    for (const r of incomingRecords) delete (r.meta as any).__edgeId

    const handler = getNodeHandler(node.type)
    const ctx: NodeExecutionContext = {
      nodeId: node.id,
      runId,
      pipelineId: pipeline.id,
      orgId: pipeline.org_id,
      config: node.config,
      input: { ...opts.input, ...mergedInput },
      incoming: incomingRecords,
      log: (level, message) => logFn(node.id, level, message),
      isCancelled,
      isPaused,
      proxyConfig: opts.proxyConfig ?? null,
      userRole: opts.userRole ?? 'user',
      emit: (records, port = 'main') => {
        const arr = Array.isArray(records) ? records : [records]
        nodeStats.produced += arr.length

        // Record up to 25 output record samples for time-travel inspection
        if (arr.length > 0 && snapshots[node.id].outputs.length < 25) {
          const remainingSlots = 25 - snapshots[node.id].outputs.length
          snapshots[node.id].outputs.push(...arr.slice(0, remainingSlots).map(r => r.data))
        }

        // Route emitted records to downstream nodes via matching edges
        const outEdges = pipeline.edges.filter(
          e => e.from === node.id && (e.fromPort ?? 'main') === port && e.to !== node.id,
        )
        for (const outRec of arr) {
          outRec.meta.sourceNodeId = node.id
          outRec.meta.trace.push(node.id)

          if (opts.onRecord) {
            try { opts.onRecord(outRec) } catch {}
          }

          for (const oe of outEdges) {
            // Branch condition: skip records that don't match
            if (oe.condition && !evalCondition(oe.condition, outRec.data)) continue
            const toQueue = queues.get(oe.to)
            if (!toQueue) continue
            const tagged: PipelineRecord = {
              ...outRec,
              meta: { ...outRec.meta, __edgeId: oe.id } as any,
            }
            toQueue.push(tagged)
          }
        }
      },
    }

    try {
      logFn(node.id, 'info', `Executing node '${node.label}'`)
      await handler.execute(ctx)
    } catch (err) {
      nodeStats.errors++
      logFn(node.id, 'error', `Node failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      nodeStats.completed_at = new Date().toISOString()
      snapshots[node.id].durationMs = Date.now() - nodeStartTime
    }

    // Mark downstream nodes that this upstream is done
    const outEdges = pipeline.edges.filter(e => e.from === node.id)
    const downstreamNodeIds = [...new Set(outEdges.map(e => e.to))]
    const readyToRun: PipelineNode[] = []
    for (const dnId of downstreamNodeIds) {
      upstreamDone.get(dnId)?.add(node.id)
      const dnIncoming = incoming.get(dnId) ?? []
      const allUpstreamDone = dnIncoming.every(e => upstreamDone.get(dnId)!.has(e.from))
      const dnNode = pipeline.nodes.find(n => n.id === dnId)
      if (allUpstreamDone && dnNode && !cancelled) {
        readyToRun.push(dnNode)
      }
    }

    // Recurse into ready downstream nodes in parallel
    await Promise.all(readyToRun.map(runNode))
  }

  // Kick off: start nodes get an empty incoming list + the run input as their config input (unless seedRecords provided)
  for (const start of startNodes) {
    if (!queues.has(start.id) || queues.get(start.id)!.length === 0) {
      queues.set(start.id, [])
    }
  }

  ;(async () => {
    try {
      logFn(undefined, 'info', `Run ${runId} started for pipeline '${pipeline.name}'${opts.replayFromNodeId ? ` (Replaying from node: ${opts.replayFromNodeId})` : ''}`)
      await Promise.all(startNodes.map(runNode))
      logFn(undefined, 'info', `Run ${runId} completed`)
    } catch (err) {
      logFn(undefined, 'error', `Run ${runId} failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      done = true
    }
  })()

  return {
    runId,
    cancel: () => { cancelled = true; logFn(undefined, 'warn', `Run ${runId} cancelled`) },
    pause: () => { paused = true; logFn(undefined, 'info', `Run ${runId} paused`) },
    resume: () => { paused = false; logFn(undefined, 'info', `Run ${runId} resumed`) },
    isDone: () => done,
    getStats: () => ({ ...stats }),
    getLog: () => [...log],
    getSnapshots: () => ({ ...snapshots }),
  }
}

/** Expose run stats, log, and snapshots for persistence (called by the runner after completion). */
export function getRunState(handle: RunHandle): { stats: RunStatsMap; log: RunLog; snapshots: RunSnapshotMap } {
  return { stats: handle.getStats(), log: handle.getLog(), snapshots: handle.getSnapshots() }
}
