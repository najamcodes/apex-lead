'use client'

import { useCallback, useState, useEffect } from 'react'
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
import { api } from '../../services/api'
import { useAuthStore, canEditPipelines, canRunPipelines } from '../../store/auth.store'
import type { WorkerNodeSummary } from '../../services/api.interface'
import type { NodeTypeDescriptor, PipelineNode, NodeEdge, PipelineDefinition, NodeType, FieldMapping } from '@sdk/core/types'

interface PipelineEditorProps {
  pipeline: PipelineDefinition
  nodeTypes: NodeTypeDescriptor[]
  activeRun?: {
    id?: string
    status?: string
    stats?: Record<string, { received: number; produced: number; errors: number }>
    snapshots?: Record<string, { inputs: any[]; outputs: any[]; durationMs?: number }>
  } | null
  onSave: (nodes: PipelineNode[], edges: NodeEdge[]) => Promise<void>
  onRun: (target?: string) => void
  onReplay?: (fromNodeId: string) => void
}

interface PipelineNodeData {
  label: string
  nodeType: NodeType
  config: Record<string, unknown>
  enabled: boolean
  descriptor?: NodeTypeDescriptor
  stats?: { received: number; produced: number; errors: number }
  snapshot?: { inputs: any[]; outputs: any[]; durationMs?: number }
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
  set: '#0ea5e9',
  aggregate: '#f59e0b',
  notify: '#f97316',
  spreadsheet: '#22c55e',
  subworkflow: '#6366f1',
  agent: '#8b5cf6',
  vision: '#06b6d4',
  approval: '#f59e0b',
}

export function PipelineEditor({ pipeline, nodeTypes, activeRun, onSave, onRun, onReplay }: PipelineEditorProps) {
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<NodeEdge | null>(null)
  const [activeTab, setActiveTab] = useState<'config' | 'timetravel'>('config')
  const [saving, setSaving] = useState(false)
  const [executionTarget, setExecutionTarget] = useState<string>('local')
  const [workers, setWorkers] = useState<WorkerNodeSummary[]>([])

  useEffect(() => {
    api.workers.list().then(res => {
      setWorkers(res.workers || [])
    }).catch(() => {})
  }, [])

  // When activeRun changes and has snapshots for selected node, default tab to timetravel
  useEffect(() => {
    if (activeRun?.snapshots && selectedNode && activeRun.snapshots[selectedNode.id]) {
      setActiveTab('timetravel')
    }
  }, [activeRun, selectedNode])

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
        stats: activeRun?.stats?.[n.id],
        snapshot: activeRun?.snapshots?.[n.id],
      },
    }))
  }, [nodeTypes, activeRun])

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

  const { role, permissions } = useAuthStore()
  const userCanEdit = canEditPipelines(role, permissions)
  const userCanRun = canRunPipelines(role, permissions)

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
  const addNode = useCallback((
    descriptor: NodeTypeDescriptor,
    position: { x: number; y: number },
    customConfig?: Record<string, unknown>,
    customLabel?: string,
  ) => {
    const id = `${descriptor.type}-${Date.now()}`
    const initialConfig: Record<string, unknown> = {}
    if (descriptor.configSchema) {
      for (const [key, field] of Object.entries(descriptor.configSchema)) {
        if (field && typeof field === 'object' && 'default' in field && (field as any).default !== undefined) {
          initialConfig[key] = (field as any).default
        }
      }
    }
    const finalConfig = { ...initialConfig, ...(customConfig || {}) }
    const newNode: PipelineNode = {
      id,
      type: descriptor.type,
      label: customLabel || descriptor.name,
      config: finalConfig,
      enabled: true,
      position,
    }
    setRfNodes((nds) => [...nds, {
      id,
      type: 'pipelineNode',
      position,
      data: { label: newNode.label, nodeType: descriptor.type, config: finalConfig, enabled: true, descriptor },
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
      data: { ...n.data, config, label: label ?? (n.data as any).label },
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

  const selectedNodeSnapshot = selectedNode ? activeRun?.snapshots?.[selectedNode.id] : undefined

  return (
    <div className="flex h-full w-full">
      {/* Left: Node palette with Sub-Workflows support */}
      <NodePalette
        nodeTypes={nodeTypes}
        onAddNode={addNode}
        currentPipelineId={pipeline.id}
      />

      {/* Center: Graph canvas */}
      <div className="flex-1 relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-lg shadow-xl backdrop-blur">
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs text-slate-400 font-medium">Target:</span>
            <select
              value={executionTarget}
              onChange={(e) => setExecutionTarget(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
            >
              <option value="local">Cloud / Central Server</option>
              <option value="farm_auto">Desktop Farm (Auto-Balance)</option>
              {workers.filter(w => w.status !== 'offline').map(w => (
                <option key={w.id} value={`worker:${w.id}`}>
                  Worker: {w.name} ({w.active_jobs}/{w.max_concurrency})
                </option>
              ))}
            </select>
          </div>

          {!userCanEdit && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
              Read-Only
            </span>
          )}

          {userCanEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}

          <button
            onClick={() => onRun(executionTarget)}
            disabled={!userCanRun}
            title={!userCanRun ? 'Insufficient permissions to run pipelines' : undefined}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium shadow-md shadow-emerald-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ Run Pipeline
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

      {/* Right: Config / Time-Travel Inspector Panel */}
      {selectedNode && (
        <div className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col overflow-hidden backdrop-blur">
          {/* Panel Tab Switcher */}
          <div className="flex border-b border-slate-800 bg-slate-900">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('timetravel')}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'timetravel'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Time-Travel Data</span>
              {selectedNodeSnapshot && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>
          </div>

          {activeTab === 'config' ? (
            <NodeConfigPanel
              node={selectedNode}
              descriptor={nodeTypes.find(d => d.type === selectedNode.type)}
              onUpdate={(config, label) => updateNodeConfig(selectedNode.id, config, label)}
              onToggleEnabled={() => toggleNodeEnabled(selectedNode.id)}
              onDelete={() => deleteNode(selectedNode.id)}
              onClose={() => setSelectedNode(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedNode.label}</h3>
                  <div className="text-slate-400 text-[11px]">
                    {selectedNodeSnapshot?.durationMs !== undefined ? (
                      <span>Execution Time: <strong className="text-emerald-400 font-mono">{selectedNodeSnapshot.durationMs}ms</strong></span>
                    ) : 'No execution data for this node in active run.'}
                  </div>
                </div>

                {onReplay && activeRun?.id && (
                  <button
                    onClick={() => onReplay(selectedNode.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium shadow transition-colors flex items-center gap-1.5"
                  >
                    <span>▶ Replay From Here</span>
                  </button>
                )}
              </div>

              {/* Input Payloads */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Input Records ({selectedNodeSnapshot?.inputs?.length || 0})</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300">
                  {selectedNodeSnapshot?.inputs?.length ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedNodeSnapshot.inputs, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-600 italic">No input records captured</span>
                  )}
                </div>
              </div>

              {/* Output Payloads */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Output Records ({selectedNodeSnapshot?.outputs?.length || 0})</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] text-emerald-300">
                  {selectedNodeSnapshot?.outputs?.length ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedNodeSnapshot.outputs, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-600 italic">No output records captured</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
  const stats = data.stats
  const snapshot = data.snapshot

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-xl min-w-[200px] transition-all ${
        data.enabled ? '' : 'opacity-40'
      } ${stats ? 'ring-2 ring-emerald-500/30' : ''}`}
      style={{ borderColor: color, backgroundColor: '#1e293b' }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 10, height: 10 }} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-white truncate">{data.label}</span>
        </div>
        <span
          className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded text-slate-300 font-medium"
          style={{ backgroundColor: `${color}25`, border: `1px solid ${color}50` }}
        >
          {data.nodeType}
        </span>
      </div>

      {/* Live Run Stats & Duration */}
      {stats && (
        <div className="mt-2 pt-2 border-t border-slate-700/80 flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-400">
            <span className="text-slate-200 font-bold">{stats.received}</span> in
          </span>
          <span className="text-emerald-400">
            → <span className="font-bold">{stats.produced}</span> out
          </span>
          {snapshot?.durationMs !== undefined && (
            <span className="text-indigo-300 font-medium">
              {snapshot.durationMs}ms
            </span>
          )}
          {stats.errors > 0 && (
            <span className="text-red-400 font-bold">
              {stats.errors} err
            </span>
          )}
        </div>
      )}

      {isBranch ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ background: '#22c55e', top: '30%', width: 10, height: 10 }} />
          <Handle type="source" position={Position.Right} id="false" style={{ background: '#ef4444', top: '70%', width: 10, height: 10 }} />
        </>
      ) : data.nodeType === 'approval' ? (
        <>
          <Handle type="source" position={Position.Right} id="approved" style={{ background: '#22c55e', top: '30%', width: 10, height: 10 }} />
          <Handle type="source" position={Position.Right} id="rejected" style={{ background: '#ef4444', top: '70%', width: 10, height: 10 }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="main" style={{ background: color, width: 10, height: 10 }} />
      )}
    </div>
  )
}
