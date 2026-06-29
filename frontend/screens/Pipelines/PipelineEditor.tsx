'use client'

import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NodePalette } from './NodePalette'
import { NodeConfigPanel } from './NodeConfigPanel'
import { EdgeMappingPanel } from './EdgeMappingPanel'
import type { NodeTypeDescriptor, PipelineNode, NodeEdge, PipelineDefinition, NodeType, FieldMapping } from '../../../shared/types/pipeline.types'

interface PipelineEditorProps {
  pipeline: PipelineDefinition
  nodeTypes: NodeTypeDescriptor[]
  onSave: (nodes: PipelineNode[], edges: NodeEdge[]) => Promise<void>
  onRun: () => void
}

interface PipelineNodeData {
  label: string
  nodeType: NodeType
  config: Record<string, unknown>
  enabled: boolean
  descriptor?: NodeTypeDescriptor
  [key: string]: unknown
}

interface PipelineEdgeData {
  mappings?: FieldMapping[]
  condition?: string
  [key: string]: unknown
}

const NODE_COLORS: Record<string, string> = {
  trigger: '#10b981',
  scraper: '#3b82f6',
  enricher: '#22c55e',
  ai: '#8b5cf6',
  store: '#f59e0b',
  http: '#06b6d4',
  transform: '#ec4899',
  branch: '#f97316',
  filter: '#64748b',
  merge: '#14b8a6',
  outreach: '#ef4444',
  connector: '#a855f7',
  delay: '#94a3b8',
  loop: '#0ea5e9',
  code: '#6366f1',
}

export function PipelineEditor({ pipeline, nodeTypes, onSave, onRun }: PipelineEditorProps) {
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<NodeEdge | null>(null)
  const [saving, setSaving] = useState(false)

  // Convert PipelineNode[] → react-flow Node[]
  const toFlowNodes = useCallback((nodes: PipelineNode[]): Node[] => {
    return nodes.map(n => ({
      id: n.id,
      type: 'pipelineNode',
      position: n.position ?? { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        config: n.config,
        enabled: n.enabled,
        descriptor: nodeTypes.find(d => d.type === n.type),
      },
    }))
  }, [nodeTypes])

  const toFlowEdges = useCallback((edges: NodeEdge[]): Edge[] => {
    return edges.map(e => ({
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle: e.fromPort ?? 'main',
      targetHandle: e.toPort ?? 'main',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      label: e.condition ? `if: ${e.condition.slice(0, 20)}...` : e.mappings?.length ? `${e.mappings.length} maps` : undefined,
      data: { mappings: e.mappings, condition: e.condition },
    }))
  }, [])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(toFlowNodes(pipeline.nodes))
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(toFlowEdges(pipeline.edges))

  // Sync react-flow node position changes back to PipelineNode positions
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    // Persist position changes to selected node
    for (const change of changes) {
      if (change.type === 'position' && change.position && selectedNode?.id === change.id) {
        setSelectedNode({ ...selectedNode, position: change.position })
      }
    }
  }, [onNodesChange, selectedNode])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
  }, [onEdgesChange])

  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${Date.now()}`,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
    }
    setRfEdges((eds) => addEdge(newEdge, eds))
  }, [setRfEdges])

  // Add a new node from the palette (drag-drop or click)
  const addNode = useCallback((descriptor: NodeTypeDescriptor, position: { x: number; y: number }) => {
    const id = `${descriptor.type}-${Date.now()}`
    const newNode: PipelineNode = {
      id,
      type: descriptor.type,
      label: descriptor.name,
      config: {},
      enabled: true,
      position,
    }
    setRfNodes((nds) => [...nds, {
      id,
      type: 'pipelineNode',
      position,
      data: { label: newNode.label, nodeType: descriptor.type, config: {}, enabled: true, descriptor },
    }])
  }, [setRfNodes])

  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedEdge(null)
    const data = node.data as PipelineNodeData
    const pipelineNode: PipelineNode = {
      id: node.id,
      type: data.nodeType,
      label: data.label,
      config: data.config,
      enabled: data.enabled,
      position: node.position,
    }
    setSelectedNode(pipelineNode)
  }, [])

  const handleEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedNode(null)
    const data = (edge.data ?? {}) as PipelineEdgeData
    const pipelineEdge: NodeEdge = {
      id: edge.id,
      from: edge.source,
      to: edge.target,
      fromPort: edge.sourceHandle ?? 'main',
      toPort: edge.targetHandle ?? 'main',
      mappings: data.mappings,
      condition: data.condition,
    }
    setSelectedEdge(pipelineEdge)
  }, [])

  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, unknown>, label?: string) => {
    setRfNodes((nds) => nds.map(n => n.id === nodeId ? {
      ...n,
      data: { ...n.data, config, label: label ?? n.data.label },
    } : n))
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, config, label: label ?? selectedNode.label })
    }
  }, [setRfNodes, selectedNode])

  const updateEdgeMappings = useCallback((edgeId: string, mappings: NodeEdge['mappings'], condition?: string) => {
    setRfEdges((eds) => eds.map(e => e.id === edgeId ? {
      ...e,
      data: { ...e.data, mappings, condition },
      label: condition ? `if: ${condition.slice(0, 20)}...` : mappings?.length ? `${mappings.length} maps` : undefined,
    } : e))
    if (selectedEdge?.id === edgeId) {
      setSelectedEdge({ ...selectedEdge, mappings, condition })
    }
  }, [setRfEdges, selectedEdge])

  const toggleNodeEnabled = useCallback((nodeId: string) => {
    setRfNodes((nds) => nds.map(n => n.id === nodeId ? {
      ...n,
      data: { ...n.data, enabled: !n.data.enabled },
    } : n))
  }, [setRfNodes])

  const deleteNode = useCallback((nodeId: string) => {
    setRfNodes((nds) => nds.filter(n => n.id !== nodeId))
    setRfEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }, [setRfNodes, setRfEdges])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const nodes: PipelineNode[] = rfNodes.map(n => {
      const d = n.data as PipelineNodeData
      return {
        id: n.id,
        type: d.nodeType,
        label: d.label,
        config: d.config,
        enabled: d.enabled,
        position: n.position,
      }
    })
    const edges: NodeEdge[] = rfEdges.map(e => {
      const d = (e.data ?? {}) as PipelineEdgeData
      return {
        id: e.id,
        from: e.source,
        to: e.target,
        fromPort: e.sourceHandle ?? 'main',
        toPort: e.targetHandle ?? 'main',
        mappings: d.mappings,
        condition: d.condition,
      }
    })
    await onSave(nodes, edges)
    setSaving(false)
  }, [rfNodes, rfEdges, onSave])

  return (
    <div className="flex h-full w-full">
      {/* Left: Node palette */}
      <NodePalette nodeTypes={nodeTypes} onAddNode={addNode} />

      {/* Center: Graph canvas */}
      <div className="flex-1 relative">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onRun}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            Run Pipeline
          </button>
        </div>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          nodeTypes={{ pipelineNode: PipelineNodeCard }}
          fitView
          className="bg-slate-900"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
          <Controls className="!bg-slate-800 !border-slate-700" />
          <MiniMap
            className="!bg-slate-800"
            nodeColor={(n) => NODE_COLORS[n.data?.nodeType as string] ?? '#64748b'}
            maskColor="rgba(15, 23, 42, 0.7)"
          />
        </ReactFlow>
      </div>

      {/* Right: Config / Mapping panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          descriptor={nodeTypes.find(d => d.type === selectedNode.type)}
          onUpdate={(config, label) => updateNodeConfig(selectedNode.id, config, label)}
          onToggleEnabled={() => toggleNodeEnabled(selectedNode.id)}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}
      {selectedEdge && (
        <EdgeMappingPanel
          edge={selectedEdge}
          onUpdate={(mappings, condition) => updateEdgeMappings(selectedEdge.id, mappings, condition)}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </div>
  )
}

// ─── Custom node card ─────────────────────────────────────────────

function PipelineNodeCard({ data }: { data: PipelineNodeData; id: string }) {
  const color = NODE_COLORS[data.nodeType] ?? '#64748b'
  const isBranch = data.nodeType === 'branch'

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-lg min-w-[180px] ${data.enabled ? '' : 'opacity-40'}`}
      style={{ borderColor: color, backgroundColor: '#1e293b' }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-white truncate">{data.label}</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{data.nodeType}</div>

      {isBranch ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ background: '#22c55e', top: '30%' }} />
          <Handle type="source" position={Position.Right} id="false" style={{ background: '#ef4444', top: '70%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="main" style={{ background: color }} />
      )}
    </div>
  )
}
