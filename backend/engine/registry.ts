// backend/engine/registry.ts
// Node type registry + descriptor catalog (for the UI palette).
// Each node type registers a handler (runtime) + descriptor (metadata/schema).

import type { NodeType, NodeTypeDescriptor } from '../../shared/types/pipeline.types'
import type { NodeHandler } from './types'

const _handlers = new Map<NodeType, NodeHandler>()
const _descriptors = new Map<NodeType, NodeTypeDescriptor>()

/** Register a node type: its runtime handler + its UI descriptor. */
export function registerNode(handler: NodeHandler, descriptor: NodeTypeDescriptor): void {
  if (handler.type !== descriptor.type) {
    throw new Error(`Node handler type '${handler.type}' does not match descriptor type '${descriptor.type}'`)
  }
  _handlers.set(handler.type, handler)
  _descriptors.set(handler.type, descriptor)
}

/** Get the runtime handler for a node type. */
export function getNodeHandler(type: NodeType): NodeHandler {
  const h = _handlers.get(type)
  if (!h) throw new Error(`No handler registered for node type '${type}'`)
  return h
}

/** Get the descriptor for a node type (used by UI). */
export function getNodeTypeDescriptor(type: NodeType): NodeTypeDescriptor | undefined {
  return _descriptors.get(type)
}

/** All registered node type descriptors — returned by GET /api/node-types. */
export function getAllNodeTypes(): NodeTypeDescriptor[] {
  return [..._descriptors.values()]
}
