// backend/nodes/index.ts
// Registers all built-in node types with the engine registry.
// Called once at server startup (after plugin registry init).

import { registerNode } from '../engine/registry'
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

let _initialized = false

/** Register all built-in node types. Idempotent. */
export function registerBuiltInNodes(): void {
  if (_initialized) return
  _initialized = true

  registerTriggerNode()
  registerScraperNode()
  registerEnricherNode()
  registerAiNode()
  registerStoreNode()
  registerHttpNode()
  registerTransformNode()
  registerBranchNode()
  registerFilterNode()
  registerMergeNode()
  registerOutreachNode()
  registerConnectorNode()
  registerDelayNode()
  registerLoopNode()
  registerCodeNode()

  console.log('[engine] Built-in node types registered')
}
