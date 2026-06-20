// shared/types/pipeline.types.ts
// Node-graph pipeline definitions. The core of the n8n-style engine.
// A pipeline is a DAG of typed nodes. Data flows between nodes as "records".
// Each node declares input/output ports with schemas; edges map output fields to input fields.

// ─────────────────────────────────────────────────────────────────
// Records — the generic data unit flowing through a pipeline
// ─────────────────────────────────────────────────────────────────

/** A single data record flowing between nodes. Domain-agnostic. */
export interface PipelineRecord {
  /** Unique id for this record instance in the run. */
  id: string
  /** Which collection this record belongs to, e.g. 'leads', 'amazon_products'. */
  collection: string
  /** The payload. Shape is defined by the collection schema or producing node. */
  data: Record<string, unknown>
  /** Per-run metadata. */
  meta: RecordMeta
}

export interface RecordMeta {
  pipelineId: string
  runId: string
  /** Node that most recently produced/modified this record. */
  sourceNodeId: string
  orgId: number
  createdAt: string
  /** Trace of nodes this record passed through (for debugging/audit). */
  trace: string[]
}

// ─────────────────────────────────────────────────────────────────
// Node types — the palette
// ─────────────────────────────────────────────────────────────────

export type NodeType =
  | 'trigger'      // starts a run (cron, manual, webhook, event)
  | 'scraper'      // produces records from an external source (uses a ScraperPlugin)
  | 'enricher'     // adds fields to a record (uses an EnricherPlugin)
  | 'ai'           // calls an LLM with a prompt template + mapped inputs
  | 'store'        // persists record into a collection (table)
  | 'http'         // calls an external HTTP API
  | 'transform'    // maps/transforms record fields (JSONata-like expressions)
  | 'branch'       // conditional routing (if/else, switch)
  | 'merge'        // joins multiple input streams
  | 'delay'        // waits / schedules
  | 'outreach'     // schedules/sends via the outreach engine
  | 'connector'    // fire-and-forget to external systems (uses a ConnectorPlugin)
  | 'loop'         // iterates over an array field
  | 'filter'       // drops records not matching a condition
  | 'code'         // user-provided JS sandbox (advanced)

// ─────────────────────────────────────────────────────────────────
// Ports — how nodes declare their data contracts
// ─────────────────────────────────────────────────────────────────

/**
 * A port is a named input or output channel on a node.
 * Output ports declare the schema of records they emit.
 * Input ports declare what shape they expect.
 * Schemas are JSON-Schema-ish (field name → type) for UI rendering.
 */
export interface PortSchema {
  /** Field name → type. Types: 'string','number','boolean','object','array','any'. */
  fields: Record<string, PortFieldType>
  /** Whether the port accepts a stream of records or a single record. */
  multiple?: boolean
  /** Human description for the UI. */
  description?: string
}

export type PortFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any' | 'null'

export interface NodePort {
  /** Port id, unique within the node. Main output is usually 'main' or 'output'. */
  id: string
  /** Display label. */
  label: string
  /** Schema of records on this port. */
  schema: PortSchema
}

// ─────────────────────────────────────────────────────────────────
// Data mapping — how fields flow from one node's output to another's input
// ─────────────────────────────────────────────────────────────────

/**
 * Maps fields from a source node's output record to fields on the
 * destination node's input. This is the per-edge data control the user
 * configures in the UI.
 *
 * `source` is a dot-path into the incoming record's `data` (e.g. "business_name"
 * or "address.city"). `target` is the field name the destination node will see
 * on its input. If `transform` is set, the value is run through an expression
 * first (simple JS expression or template with {{source}} placeholders).
 */
export interface FieldMapping {
  /** Dot-path into the source record's data, e.g. "business_name" or "ai_site_score". */
  source: string
  /** Field name the destination node reads from its input, e.g. "company". */
  target: string
  /** Optional transform: a template "Hello {{business_name}}" or expression "value * 2". */
  transform?: string
  /** Optional static default if source path is missing. */
  default?: unknown
}

// ─────────────────────────────────────────────────────────────────
// Nodes & edges — the graph
// ─────────────────────────────────────────────────────────────────

export interface PipelineNode {
  /** Unique id within the pipeline, e.g. "scrape_1". */
  id: string
  /** Node type from the palette. */
  type: NodeType
  /** Display label shown on the node card. */
  label: string
  /** Node-type-specific config. Validated against the node type's configSchema. */
  config: Record<string, unknown>
  /** Whether this node is active. Inactive nodes are skipped (and their edges). */
  enabled: boolean
  /** UI position in the graph editor. */
  position?: { x: number; y: number }
  /** Per-node notes for the user. */
  notes?: string
}

export interface NodeEdge {
  /** Edge id. */
  id: string
  /** Source node id. */
  from: string
  /** Source output port id (default 'main'). */
  fromPort?: string
  /** Destination node id. */
  to: string
  /** Destination input port id (default 'main'). */
  toPort?: string
  /**
   * Field mappings applied as records cross this edge.
   * Empty/absent = pass through all fields unchanged.
   */
  mappings?: FieldMapping[]
  /**
   * For branch nodes: only records matching this condition travel this edge.
   * Expression evaluated against the record's data, e.g. "data.ai_site_score >= 70".
   */
  condition?: string
}

// ─────────────────────────────────────────────────────────────────
// Pipeline definition — the persisted graph
// ─────────────────────────────────────────────────────────────────

export type PipelineStatus = 'active' | 'paused' | 'draft'

export interface PipelineDefinition {
  id: string
  org_id: number
  name: string
  description?: string
  /** Which collection records produced by this pipeline belong to. */
  collection: string
  status: PipelineStatus
  nodes: PipelineNode[]
  edges: NodeEdge[]
  /** Trigger config (cron schedule, webhook, manual). */
  trigger?: TriggerConfig
  /** JSON schema version for future migrations. */
  version: number
  created_at: string
  updated_at: string
}

export interface TriggerConfig {
  type: 'manual' | 'cron' | 'webhook' | 'event'
  /** Cron expression for type 'cron'. */
  cron?: string
  /** Event name for type 'event', e.g. 'lead.created'. */
  event?: string
  /** Webhook secret for type 'webhook'. */
  secret?: string
}

// ─────────────────────────────────────────────────────────────────
// Run — an execution instance
// ─────────────────────────────────────────────────────────────────

export type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface PipelineRun {
  id: string
  pipeline_id: string
  org_id: number
  status: RunStatus
  started_at: string
  completed_at: string | null
  /** Input config for this run (overrides pipeline trigger params). */
  input: Record<string, unknown>
  /** Counts per node: { nodeId: { received, produced, errors } }. */
  stats: Record<string, NodeRunStats>
  /** Last error message if failed. */
  error: string | null
  /** Final log lines (capped). */
  log: RunLogEntry[]
}

export interface NodeRunStats {
  received: number
  produced: number
  errors: number
  started_at?: string
  completed_at?: string
}

export interface RunLogEntry {
  ts: string
  nodeId?: string
  level: 'info' | 'warn' | 'error'
  message: string
}

// ─────────────────────────────────────────────────────────────────
// Node type descriptor — describes a node kind for the UI palette
// ─────────────────────────────────────────────────────────────────

/**
 * Metadata about a node type, exposed via GET /api/node-types so the UI
 * can render the palette, config form, and port schemas without hardcoding.
 */
export interface NodeTypeDescriptor {
  type: NodeType
  name: string
  description: string
  /** Category for palette grouping. */
  category: 'Trigger' | 'Source' | 'Process' | 'Logic' | 'Storage' | 'Output' | 'Advanced'
  /** Icon name (lucide) for the palette. */
  icon: string
  /** Default color for the node card. */
  color: string
  /** Zod-style config schema (JSON-encoded) for the config panel. */
  configSchema: Record<string, unknown>
  /** Static input port definitions (a node may also declare dynamic ports). */
  inputs: NodePort[]
  /** Static output port definitions. */
  outputs: NodePort[]
  /** Whether this node can start a pipeline (no inputs required). */
  isStart: boolean
  /** Whether the node produces records (vs. just consuming). */
  produces: boolean
  /** Help text shown in the config panel. */
  help?: string
}

// ─────────────────────────────────────────────────────────────────
// Legacy types — preserved for backward compatibility with the old
// lead-generation pipeline (ScrapeTarget, QueryProfile, DigestRun).
// These power the existing Pipeline screen and its DB queries.
// ─────────────────────────────────────────────────────────────────

export type TargetStatus = 'active' | 'paused' | 'error'

export interface ScrapeTarget {
  id:             number
  label:          string
  query:          string
  city:           string
  country:        string
  max_per_run:    number
  min_ai_score:   number
  website_filter: 'all' | 'none_only' | 'outdated_only'
  status:         TargetStatus
  use_proxy:      boolean
  last_run_at:    string | null
  next_run_at:    string | null
  total_found:    number
  created_at:     string
}

export interface ScrapeTargetInsert {
  label:          string
  query:          string
  city:           string
  country:        string
  max_per_run:    number
  min_ai_score:   number
  website_filter: ScrapeTarget['website_filter']
  use_proxy:      boolean
}

export interface DigestRun {
  id:               number
  run_at:           string
  targets_run:      number
  total_scraped:    number
  total_qualified:  number
  total_no_website: number
  total_new:        number
  digest_sent:      boolean
  digest_error:     string | null
  top_leads:        string
}

export type QueryProfileStatus = 'active' | 'paused' | 'error'

export interface QueryProfile {
  id:               number
  label:            string
  target_audience:  string
  core_offer:       string
  cities:           string
  countries:        string
  status:           QueryProfileStatus
  queries_generated: number
  created_at:       string
  updated_at:       string
}

export interface QueryProfileInsert {
  label:            string
  target_audience:  string
  core_offer:       string
  cities:           string[]
  countries:        string[]
  status?:          QueryProfileStatus
}
