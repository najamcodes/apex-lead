export interface DagNodeDef {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface DagEdgeDef {
  id?: string
  source: string
  target: string
}

export interface DagGraph {
  nodes: DagNodeDef[]
  edges: DagEdgeDef[]
}

export class TopologicalSorter {
  /**
   * Validates graph is a valid DAG (no cycles) and returns sorted execution layers.
   */
  public static sort(graph: DagGraph): {
    sortedNodeIds: string[]
    executionLayers: string[][]
    hasCycle: boolean
  } {
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()
    const nodeIds = new Set(graph.nodes.map((n) => n.id))

    // Initialize in-degree and adjacency list
    for (const id of nodeIds) {
      inDegree.set(id, 0)
      adjList.set(id, [])
    }

    // Build graph dependencies
    for (const edge of graph.edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        adjList.get(edge.source)!.push(edge.target)
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
      }
    }

    // Kahn's Algorithm layer-by-layer
    let currentLayer = Array.from(nodeIds).filter((id) => (inDegree.get(id) || 0) === 0)
    const sortedNodeIds: string[] = []
    const executionLayers: string[][] = []

    while (currentLayer.length > 0) {
      executionLayers.push([...currentLayer])
      const nextLayer: string[] = []

      for (const node of currentLayer) {
        sortedNodeIds.push(node)
        for (const neighbor of adjList.get(node) || []) {
          const newDeg = (inDegree.get(neighbor) || 0) - 1
          inDegree.set(neighbor, newDeg)
          if (newDeg === 0) {
            nextLayer.push(neighbor)
          }
        }
      }

      currentLayer = nextLayer
    }

    const hasCycle = sortedNodeIds.length !== nodeIds.size

    return {
      sortedNodeIds,
      executionLayers,
      hasCycle,
    }
  }
}
