// backend/engine/custom-nodes.ts
// Dynamic runtime loader for user-created custom nodes & plugins.

import { getDataSource } from '../db'
import { CustomNodeEntity } from '../db/entities/CustomNodeEntity'
import { registerNode } from './registry'
import type { NodeExecutionContext, NodeHandler } from './types'
import type { NodeTypeDescriptor } from '@sdk/core/types/pipeline.types'

/**
 * Register a single custom node definition into the engine runtime.
 */
export function registerCustomNodeHandler(node: CustomNodeEntity): void {
  const nodeType = (node.node_key || `custom_${node.id}`) as any

  let parsedConfigSchema: Record<string, unknown> = {}
  try {
    parsedConfigSchema = JSON.parse(node.config_schema || '{}')
  } catch {
    parsedConfigSchema = {}
  }

  let parsedInputs: any[] = [{ id: 'main', label: 'Input' }]
  try {
    parsedInputs = JSON.parse(node.inputs || '[]')
    if (!parsedInputs || parsedInputs.length === 0) parsedInputs = [{ id: 'main', label: 'Input' }]
  } catch {
    parsedInputs = [{ id: 'main', label: 'Input' }]
  }

  let parsedOutputs: any[] = [{ id: 'main', label: 'Output' }]
  try {
    parsedOutputs = JSON.parse(node.outputs || '[]')
    if (!parsedOutputs || parsedOutputs.length === 0) parsedOutputs = [{ id: 'main', label: 'Output' }]
  } catch {
    parsedOutputs = [{ id: 'main', label: 'Output' }]
  }

  const handler: NodeHandler = {
    type: nodeType,
    async execute(ctx: NodeExecutionContext): Promise<void> {
      ctx.log('info', `Executing custom node "${node.name}"...`)

      // Create sandboxed execution scope for user JavaScript
      const sandbox = {
        ctx,
        input: ctx.input,
        incoming: ctx.incoming,
        config: ctx.config,
        log: (level: 'info' | 'warn' | 'error', msg: string) => ctx.log(level, msg),
        emit: (rec: any) => ctx.emit(rec),
        console: {
          log: (...args: any[]) => ctx.log('info', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          warn: (...args: any[]) => ctx.log('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          error: (...args: any[]) => ctx.log('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        },
      }

      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
        const fn = new AsyncFunction('sandbox', `
          with (sandbox) {
            ${node.code}
          }
        `)

        await fn(sandbox)
      } catch (err: any) {
        ctx.log('error', `Custom node "${node.name}" execution failed: ${err.message}`)
        throw err
      }
    },
  }

  const descriptor: NodeTypeDescriptor = {
    type: nodeType,
    name: node.name,
    description: node.description || 'User-created custom node',
    category: (node.category || 'Custom') as any,
    icon: node.icon || 'Code',
    color: node.color || '#6366f1',
    inputs: parsedInputs,
    outputs: parsedOutputs,
    isStart: false,
    produces: true,
    configSchema: parsedConfigSchema as any,
    isCustom: true,
  }

  registerNode(handler, descriptor)
}

/**
 * Load all enabled custom nodes across orgs and register into the node registry.
 */
export async function loadAndRegisterCustomNodes(): Promise<void> {
  try {
    const ds = getDataSource()
    if (!ds.isInitialized) return
    const repo = ds.getRepository(CustomNodeEntity)
    const customNodes = await repo.find({ where: { enabled: true } })

    for (const node of customNodes) {
      try {
        registerCustomNodeHandler(node)
      } catch (err) {
        console.warn(`[custom-nodes] Failed to register custom node ${node.id}:`, err)
      }
    }
  } catch (err) {
    console.warn('[custom-nodes] Failed to load custom nodes from DB:', err)
  }
}
