// backend/engine/types.ts
// Internal engine types — node execution contract.

import type { PipelineRecord, NodeRunStats, RunLogEntry } from '../../shared/types/pipeline.types'

/** Context handed to every node's execute() function. */
export interface NodeExecutionContext {
  /** Node id being executed. */
  nodeId: string
  /** Run id. */
  runId: string
  /** Pipeline id. */
  pipelineId: string
  /** Org id (tenant). */
  orgId: number
  /** The node's resolved config (validated against its schema). */
  config: Record<string, unknown>
  /** Fields mapped into this node from incoming edges (merged across all inputs). */
  input: Record<string, unknown>
  /**
   * The full incoming records (one per upstream edge that fed this node).
   * Most nodes process one record at a time; merge/branch nodes see multiple.
   */
  incoming: PipelineRecord[]
  /** Logger scoped to this run. */
  log: (level: 'info' | 'warn' | 'error', message: string) => void
  /** Cancellation check — nodes should poll this in long loops. */
  isCancelled: () => boolean
  /** Pause check — nodes should poll this and block while paused. */
  isPaused: () => Promise<void>
  /** Emit a record on the named output port (default 'main'). */
  emit: (record: PipelineRecord | PipelineRecord[], port?: string) => void
}

/**
 * A node implementation. Each node type (scraper, ai, store, ...) implements this.
 * Execute receives a context and calls ctx.emit() to produce output records.
 */
export interface NodeHandler {
  /** The NodeType this handler serves. */
  type: import('../../shared/types/pipeline.types').NodeType
  /**
   * Run the node. Must be async. Yields records via ctx.emit().
   * For source nodes (scraper), incoming is empty and config drives the fetch.
   */
  execute(ctx: NodeExecutionContext): Promise<void>
}

/** Aggregated stats for a run, keyed by node id. */
export type RunStatsMap = Record<string, NodeRunStats>

export type RunLog = RunLogEntry[]
