// backend/nodes/descriptors.ts
// Helpers for building NodeTypeDescriptor config schemas as plain JSON
// (so they can be serialized to the UI without Zod instances).

import type { NodeTypeDescriptor, NodePort, PortSchema } from '../../shared/types/pipeline.types'

export const anySchema: PortSchema = { fields: {}, multiple: true, description: 'Any record' }

export const singleAnySchema: PortSchema = { fields: {}, multiple: false, description: 'A single record' }

export const mainOutput: NodePort = { id: 'main', label: 'Output', schema: anySchema }
export const mainInput: NodePort = { id: 'main', label: 'Input', schema: anySchema }

export const branchOutputs: NodePort[] = [
  { id: 'true', label: 'True', schema: anySchema },
  { id: 'false', label: 'False', schema: anySchema },
]

/** Build a config schema fragment for a string field. */
export function strField(label: string, required = false, description?: string, defaultValue?: string) {
  return { type: 'string', label, required, description, default: defaultValue }
}
export function numField(label: string, required = false, description?: string, defaultValue?: number) {
  return { type: 'number', label, required, description, default: defaultValue }
}
export function boolField(label: string, description?: string, defaultValue = false) {
  return { type: 'boolean', label, description, default: defaultValue }
}
export function selectField(label: string, options: string[], description?: string, defaultValue?: string) {
  return { type: 'select', label, options, description, default: defaultValue }
}
export function textField(label: string, required = false, description?: string) {
  return { type: 'text', label, required, description }
}
export function jsonField(label: string, description?: string, defaultValue: unknown = {}) {
  return { type: 'json', label, description, default: defaultValue }
}

export function makeDescriptor(partial: Partial<NodeTypeDescriptor> & Pick<NodeTypeDescriptor, 'type' | 'name' | 'description' | 'category' | 'icon' | 'color' | 'configSchema'>): NodeTypeDescriptor {
  return {
    inputs: [],
    outputs: [mainOutput],
    isStart: false,
    produces: false,
    ...partial,
  }
}
