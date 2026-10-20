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
import { registerWaterfallEnricherNode } from './waterfall-enricher-node'
import { registerJobScraperNode } from './job-scraper-node'
import { registerNewsRadarNode } from './news-radar-node'
import { registerLinkedInNode } from './linkedin-node'
import { registerVoiceCallNode } from './voice-call-node'
import { registerCrmUpsertNode } from './crm-upsert-node'
import { registerBatchNode } from './batch-node'

let _initialized = false

/** Register all built-in node types. Idempotent. */
export function registerBuiltInNodes(): void {
  if (_initialized) return
  _initialized = true

  // ── Triggers ──────────────────────────────────────
  registerTriggerNode()

  // ── Sources ───────────────────────────────────────
  registerScraperNode()
  registerJobScraperNode()  // career boards & hiring intent signals
  registerHttpNode()       // isStart: true — can run with no upstream
  registerStoreNode()      // isStart: true — query mode
  registerSetNode()        // isStart: true — seed mode
  registerSpreadsheetNode() // isStart: true — paste CSV mode

  // ── Enrichment / Processing / Autonomous AI ───────
  registerEnricherNode()
  registerWaterfallEnricherNode() // multi-vendor cascading discovery & verification
  registerNewsRadarNode()          // funding, PR, executive intent triggers
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
  registerBatchNode()

  // ── Storage ───────────────────────────────────────
  registerCrmUpsertNode() // 2-way sync with HubSpot, Salesforce, Pipedrive
  // (store-node registered in Sources as it's bidirectional)

  // ── Output / Notification ─────────────────────────
  registerOutreachNode()
  registerLinkedInNode()   // LinkedIn profile views, connection notes, InMails
  registerVoiceCallNode()  // Conversational Voice AI SDR outbound calling
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
export { registerWaterfallEnricherNode } from './waterfall-enricher-node'
export { registerJobScraperNode } from './job-scraper-node'
export { registerNewsRadarNode } from './news-radar-node'
export { registerLinkedInNode } from './linkedin-node'
export { registerVoiceCallNode } from './voice-call-node'
export { registerCrmUpsertNode } from './crm-upsert-node'
export { registerBatchNode } from './batch-node'
