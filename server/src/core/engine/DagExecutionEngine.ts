import { TopologicalSorter, DagGraph, DagNodeDef } from './TopologicalSorter'
import { SandboxedCodeRunner } from './SandboxedCodeRunner'

export interface ExecutionResult {
  success: boolean
  recordsProcessed: number
  recordsEmitted: number
  records: Record<string, unknown>[]
  nodeLogs: Record<string, { inCount: number; outCount: number; durationMs: number }>
}

export class DagExecutionEngine {
  /**
   * Executes visual DAG pipeline in topological layer order.
   */
  public async executePipeline(
    graph: DagGraph,
    initialRecords: Record<string, unknown>[] = []
  ): Promise<ExecutionResult> {
    const { sortedNodeIds, executionLayers, hasCycle } = TopologicalSorter.sort(graph)

    if (hasCycle) {
      throw new Error('Cycle detected in visual pipeline graph. DAG must be strictly acyclic.')
    }

    const nodeOutputs = new Map<string, Record<string, unknown>[]>()
    const nodeLogs: Record<string, { inCount: number; outCount: number; durationMs: number }> = {}

    // Map parent nodes
    const parentsOf = new Map<string, string[]>()
    for (const node of graph.nodes) {
      parentsOf.set(node.id, [])
    }
    for (const edge of graph.edges) {
      if (parentsOf.has(edge.target)) {
        parentsOf.get(edge.target)!.push(edge.source)
      }
    }

    let totalProcessed = initialRecords.length

    // Execute layer by layer
    for (const layer of executionLayers) {
      for (const nodeId of layer) {
        const start = performance.now()
        const nodeDef = graph.nodes.find((n) => n.id === nodeId)
        if (!nodeDef) continue

        // Gather incoming records from parents
        const parents = parentsOf.get(nodeId) || []
        let inputRecords: Record<string, unknown>[] = []

        if (parents.length === 0) {
          inputRecords = [...initialRecords]
        } else {
          // Merge records from parent outputs
          const merged: Record<string, unknown>[] = []
          for (const p of parents) {
            merged.push(...(nodeOutputs.get(p) || []))
          }
          inputRecords = merged
        }

        // Process records based on node type
        let outputRecords: Record<string, unknown>[] = []

        switch (nodeDef.type) {
          case 'source': {
            if (nodeDef.data?.records && Array.isArray(nodeDef.data.records)) {
              outputRecords = [...nodeDef.data.records]
            } else {
              outputRecords = inputRecords.length > 0 ? [...inputRecords] : [...initialRecords]
            }
            totalProcessed += outputRecords.length
            break
          }

          case 'transform':
          case 'code': {
            const userScript = typeof nodeDef.data?.code === 'string' ? nodeDef.data.code : 'return record;'
            outputRecords = inputRecords.map((r) => SandboxedCodeRunner.executeTransform(userScript, r))
            break
          }

          case 'filter': {
            const data = nodeDef.data || {}
            const minRating = typeof data.minRating === 'number' ? data.minRating : undefined
            const requireEmail = Boolean(data.requireEmail)
            const field = typeof data.field === 'string' ? data.field : undefined
            const operator = typeof data.operator === 'string' ? data.operator : 'equals'
            const value = data.value

            outputRecords = inputRecords.filter((r) => {
              if (minRating !== undefined && typeof r.rating === 'number') {
                if (r.rating < minRating) return false
              }
              if (requireEmail) {
                if (!r.email || typeof r.email !== 'string' || r.email.trim() === '') return false
              }
              if (field) {
                const itemVal = r[field]
                const op = operator || 'equals'
                if (op === 'exists') return itemVal !== undefined && itemVal !== null && itemVal !== ''
                if (op === 'equals') return String(itemVal) === String(value)
                if (op === 'not_equals') return String(itemVal) !== String(value)
                if (op === 'contains') return String(itemVal).toLowerCase().includes(String(value).toLowerCase())
              }
              return true
            })
            break
          }

          case 'enricher': {
            outputRecords = inputRecords.map((r) => ({
              ...r,
              enriched: true,
              enrichmentTimestamp: new Date().toISOString(),
            }))
            break
          }

          default:
            // Standard passthrough
            outputRecords = [...inputRecords]
            break
        }

        const durationMs = Math.round(performance.now() - start)
        nodeOutputs.set(nodeId, outputRecords)
        nodeLogs[nodeId] = {
          inCount: inputRecords.length,
          outCount: outputRecords.length,
          durationMs,
        }
      }
    }

    // Leaf nodes output is the final emitted record set
    const allSources = new Set(graph.edges.map((e) => e.source))
    const leafNodes = graph.nodes.filter((n) => !allSources.has(n.id))
    const finalRecords: Record<string, unknown>[] = []

    for (const leaf of leafNodes) {
      finalRecords.push(...(nodeOutputs.get(leaf.id) || []))
    }

    return {
      success: true,
      recordsProcessed: totalProcessed,
      recordsEmitted: finalRecords.length,
      records: finalRecords,
      nodeLogs,
    }
  }
}
