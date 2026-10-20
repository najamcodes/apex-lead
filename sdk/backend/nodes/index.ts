// backend/nodes/index.ts
// Registers all built-in node types with the engine registry.
// Called once at server startup (after plugin registry init).

import { registerScraperNode } from './scraper-node'
import { registerEnricherNode } from './enricher-node'
import { registerAiNode } from './ai-node'
import { registerStoreNode } from './store-node'
import { registerHttpNode } from './http-node'
import { registerTransformNode } from './transform-node'
import { registerBranchNode } from './branch-node'
import { registerFilterNode } from './filter-node'
import { registerMergeNode } from './merge-node'
import { registerOutreachNode } from './outreach-node'
import { registerConnectorNode } from './connector-node'
import { registerTriggerNode } from './trigger-node'
import { registerDelayNode } from './delay-node'
import { registerLoopNode } from './loop-node'
import { registerCodeNode } from './code-node'
import { registerSetNode } from './set-node'
import { registerAggregateNode } from './aggregate-node'
import { registerNotifyNode } from './notify-node'
import { registerSpreadsheetNode } from './spreadsheet-node'
import { registerSubworkflowNode } from './subworkflow-node'
import { registerAgentNode } from './agent-node'
import { registerVisionNode } from './vision-node'
import { registerApprovalNode } from './approval-node'
import { registerN8nBridgeNode } from './n8n-bridge-node'
import { registerDedupeNode } from './dedupe-node'
import { registerFormatNode } from './format-node'

let _initialized = false

/** Register all built-in node types. Idempotent. */
export function registerBuiltInNodes(): void {
  if (_initialized) return
  _initialized = true

  // ── Triggers ──────────────────────────────────────
  registerTriggerNode()

  // ── Sources ───────────────────────────────────────
  registerScraperNode()
  registerHttpNode()       // isStart: true — can run with no upstream
  registerStoreNode()      // isStart: true — query mode
  registerSetNode()        // isStart: true — seed mode
  registerSpreadsheetNode() // isStart: true — paste CSV mode

  // ── Enrichment / Processing / Autonomous AI ───────
  registerEnricherNode()
  registerAiNode()
  registerAgentNode()
  registerVisionNode()

  // ── Transform ─────────────────────────────────────
  registerTransformNode()
  registerCodeNode()
  registerAggregateNode()
  registerFormatNode()

  // ── Logic / Flow / Approval ───────────────────────
  registerBranchNode()
  registerFilterNode()
  registerMergeNode()
  registerLoopNode()
  registerDelayNode()
  registerApprovalNode()
  registerDedupeNode()

  // ── Storage ───────────────────────────────────────
  // (store-node registered in Sources as it's bidirectional)

  // ── Output / Notification ─────────────────────────
  registerOutreachNode()
  registerConnectorNode()
  registerNotifyNode()
  registerN8nBridgeNode()

  // ── Advanced / Sub-Workflows ───────────────────────
  registerSubworkflowNode()

  console.log('[engine] Built-in node types registered')
}

export { registerN8nBridgeNode } from './n8n-bridge-node'
export { registerDedupeNode } from './dedupe-node'
export { registerFormatNode } from './format-node'
