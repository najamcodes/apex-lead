'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import { PipelineEditor } from './PipelineEditor'
import { useAuthStore, canEditPipelines } from '../../store/auth.store'
import type { NodeTypeDescriptor, PipelineDefinition, PipelineNode, NodeEdge, PipelineRun } from '../../../shared/types/pipeline.types'

export function Pipelines() {
  const { role, permissions } = useAuthStore()
  const userCanEdit = canEditPipelines(role, permissions)
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [nodeTypes, setNodeTypes] = useState<NodeTypeDescriptor[]>([])
  const [selected, setSelected] = useState<PipelineDefinition | null>(null)
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewTab, setViewTab] = useState<'my-pipelines' | 'templates'>('my-pipelines')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [pipelineRes, nodeRes, tplRes] = await Promise.all([
        api.pipelines.list(),
        api.pipelines.nodeTypes(),
        api.pipelines.templates().catch(() => ({ templates: [] })),
      ])
      setPipelines((pipelineRes as any).pipelines ?? [])
      setNodeTypes((nodeRes as any).types ?? [])
      setTemplates((tplRes as any).templates ?? [])
    } catch (err) {
      console.error('Failed to load pipelines:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRuns = useCallback(async (pipelineId: string) => {
    try {
      const res = await api.pipelines.listRuns(pipelineId) as any
      setRuns(res.runs ?? [])
    } catch {
      setRuns([])
    }
  }, [])

  const handleSelect = (p: PipelineDefinition) => {
    setSelected(p)
    loadRuns(p.id)
    setActiveRun(null)
  }

  const handleSave = useCallback(async (nodes: PipelineNode[], edges: NodeEdge[]) => {
    if (!selected) return
    try {
      await api.pipelines.update(selected.id, { nodes, edges })
      setSelected({ ...selected, nodes, edges })
      setPipelines(prev => prev.map(p => p.id === selected.id ? { ...p, nodes, edges } : p))
    } catch (err) {
      console.error('Failed to save pipeline:', err)
      alert('Failed to save pipeline. Check console.')
    }
  }, [selected])

  const handleRun = useCallback(async (target?: string) => {
    if (!selected) return
    try {
      await handleSave(selected.nodes, selected.edges)
      const res = await api.pipelines.run(selected.id, {}, target) as any
      const runId = res.runId
      if (res.execution_target === 'farm') {
        alert(`Dispatched to desktop worker: ${res.workerName || res.workerId}`)
      }
      // Poll for run status
      const poll = async () => {
        try {
          const run = await api.pipelines.getRun(runId) as any
          setActiveRun(run)
          if (run.status === 'running' || run.status === 'paused') {
            setTimeout(poll, 1500)
          } else {
            loadRuns(selected.id)
          }
        } catch { /* ignore poll errors */ }
      }
      poll()
    } catch (err: any) {
      console.error('Failed to run pipeline:', err)
      alert(`Failed to start pipeline run: ${err?.message || err}`)
    }
  }, [selected, handleSave, loadRuns])

  const handleCreate = async () => {
    try {
      const res = await api.pipelines.create({
        name: 'New Pipeline',
        collection: 'data',
        status: 'draft',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            label: 'Manual Trigger',
            enabled: true,
            position: { x: 100, y: 150 },
            config: { type: 'manual' },
          },
        ],
        edges: [],
      }) as any
      setPipelines(prev => [res, ...prev])
      handleSelect(res)
    } catch (err) {
      console.error('Failed to create pipeline:', err)
    }
  }

  const handleDuplicate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      const copy = await api.pipelines.duplicate(id) as any
      setPipelines(prev => [copy, ...prev])
    } catch (err) {
      console.error('Failed to duplicate pipeline:', err)
    }
  }

  const handleUseTemplate = async (templateId: string) => {
    try {
      const instantiated = await api.pipelines.instantiateTemplate(templateId) as any
      setPipelines(prev => [instantiated, ...prev])
      handleSelect(instantiated)
    } catch (err) {
      console.error('Failed to instantiate template:', err)
      alert('Failed to create pipeline from template.')
    }
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm('Delete this pipeline? This cannot be undone.')) return
    try {
      await api.pipelines.delete(id)
      setPipelines(prev => prev.filter(p => p.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      console.error('Failed to delete pipeline:', err)
    }
  }

  const handleStatusToggle = async (p: PipelineDefinition, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextStatus: import('../../../shared/types/pipeline.types').PipelineStatus = p.status === 'active' ? 'paused' : 'active'
    try {
      await api.pipelines.update(p.id, { status: nextStatus })
      const updated: PipelineDefinition = { ...p, status: nextStatus }
      setPipelines(prev => prev.map(item => item.id === p.id ? updated : item))
      if (selected?.id === p.id) setSelected(updated)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleReplay = useCallback(async (fromNodeId: string) => {
    if (!selected || !activeRun?.id) return
    try {
      const res = await api.pipelines.replay(selected.id, activeRun.id, fromNodeId) as any
      const newRunId = res.runId
      alert(`Replaying pipeline from node '${fromNodeId}' (Run ID: ${newRunId.slice(0, 8)})`)
      
      const poll = async () => {
        try {
          const run = await api.pipelines.getRun(newRunId) as any
          setActiveRun(run)
          if (run.status === 'running' || run.status === 'paused') {
            setTimeout(poll, 1500)
          } else {
            loadRuns(selected.id)
          }
        } catch { /* ignore poll errors */ }
      }
      poll()
    } catch (err: any) {
      console.error('Failed to replay pipeline:', err)
      alert(`Failed to replay pipeline: ${err?.message || err}`)
    }
  }, [selected, activeRun, loadRuns])

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Loading automation pipelines...</div>
  }

  if (selected) {
    return (
      <div className="h-full flex flex-col">
        {/* Pipeline Editor Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelected(null); loadAll() }}
              className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              ← Back
            </button>
            <div className="h-4 w-[1px] bg-slate-700" />
            <input
              type="text"
              value={selected.name}
              onChange={async (e) => {
                const newName = e.target.value
                setSelected({ ...selected, name: newName })
                await api.pipelines.update(selected.id, { name: newName })
                setPipelines(prev => prev.map(p => p.id === selected.id ? { ...p, name: newName } : p))
              }}
              className="text-base font-semibold text-white bg-transparent border border-transparent hover:border-slate-700 focus:border-emerald-500 rounded px-2 py-0.5 focus:outline-none transition-colors"
            />
            <button
              onClick={() => handleStatusToggle(selected)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium cursor-pointer border transition-colors ${
                selected.status === 'active'
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                  : selected.status === 'paused'
                  ? 'bg-amber-950/80 border-amber-700 text-amber-300 hover:bg-amber-900'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Click to toggle status"
            >
              ● {selected.status}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="bg-slate-800 px-2 py-1 rounded font-mono">
              target: <strong className="text-slate-200">{selected.collection}</strong>
            </span>
            <button
              onClick={(e) => handleDuplicate(selected.id, e)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Duplicate
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeRun && (
            <RunBanner run={activeRun} onClose={() => setActiveRun(null)} />
          )}
          <PipelineEditor
            pipeline={selected}
            nodeTypes={nodeTypes}
            activeRun={activeRun}
            onSave={handleSave}
            onRun={handleRun}
            onReplay={handleReplay}
          />
        </div>

        {runs.length > 0 && (
          <div className="border-t border-slate-800 bg-slate-900 p-3 max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Execution History (Click to Inspect Time-Travel Payloads)
              </h3>
              {activeRun && (
                <button
                  onClick={() => setActiveRun(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Clear Inspection
                </button>
              )}
            </div>
            <div className="space-y-1">
              {runs.slice(0, 8).map(r => {
                const isInspecting = activeRun?.id === r.id
                return (
                  <div
                    key={r.id}
                    onClick={async () => {
                      try {
                        const fullRun = await api.pipelines.getRun(r.id)
                        setActiveRun(fullRun)
                      } catch {
                        setActiveRun(r)
                      }
                    }}
                    className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded cursor-pointer transition-colors ${
                      isInspecting ? 'bg-indigo-950/60 border border-indigo-700/60 text-white' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        r.status === 'completed' ? 'bg-emerald-500' :
                        r.status === 'failed' ? 'bg-red-500' :
                        r.status === 'running' ? 'bg-blue-500 animate-pulse' :
                        'bg-slate-500'
                      }`} />
                      <span className="font-mono text-slate-300 text-[11px] font-medium">{r.id.slice(0, 8)}</span>
                      <span className="text-slate-500 text-[11px]">{new Date(r.started_at).toLocaleString()}</span>
                      {isInspecting && (
                        <span className="px-1.5 py-0.2 rounded bg-indigo-900/80 text-indigo-300 text-[10px] font-mono">
                          Inspecting Time-Travel
                        </span>
                      )}
                    </div>
                    <span className={`font-medium text-xs ${
                      r.status === 'completed' ? 'text-emerald-400' :
                      r.status === 'failed' ? 'text-red-400' :
                      r.status === 'running' ? 'text-blue-400' :
                      'text-slate-400'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Automation Pipelines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Build node-graph automations to scrape, transform, integrate APIs, and trigger workflows (like n8n).
          </p>
        </div>
        {userCanEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors"
            >
              + Blank Pipeline
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 mb-6">
        <button
          onClick={() => setViewTab('my-pipelines')}
          className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
            viewTab === 'my-pipelines'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          My Pipelines ({pipelines.length})
        </button>
        <button
          onClick={() => setViewTab('templates')}
          className={`pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            viewTab === 'templates'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Template Gallery</span>
          <span className="px-1.5 py-0.2 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded text-[10px]">
            {templates.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pipelines List */}
      {viewTab === 'my-pipelines' && (
        <div className="grid gap-3">
          {pipelines.length === 0 && (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
              <div className="text-slate-400 font-medium mb-1">No pipelines yet</div>
              <p className="text-xs text-slate-500 mb-4">Start from a blank canvas or choose a pre-built template.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleCreate}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                >
                  Create Blank
                </button>
                <button
                  onClick={() => setViewTab('templates')}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium"
                >
                  Browse Templates
                </button>
              </div>
            </div>
          )}
          {pipelines.map(p => (
            <div
              key={p.id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer group transition-all"
              onClick={() => handleSelect(p)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-medium text-white group-hover:text-emerald-400 transition-colors">
                      {p.name}
                    </h3>
                    <button
                      onClick={(e) => handleStatusToggle(p, e)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        p.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        p.status === 'paused' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {p.status}
                    </button>
                  </div>
                  {p.description && (
                    <p className="text-sm text-slate-400 mt-1 truncate">{p.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500 font-mono">
                    <span>{p.nodes?.length ?? 0} nodes</span>
                    <span>•</span>
                    <span>{p.edges?.length ?? 0} links</span>
                    <span>•</span>
                    <span>collection: <span className="text-slate-400">{p.collection}</span></span>
                    <span>•</span>
                    <span>updated {new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {userCanEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDuplicate(p.id, e)}
                      className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="text-xs px-2.5 py-1 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Template Gallery */}
      {viewTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900">
                    {tpl.category}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {tpl.definition.nodes.length} nodes
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">{tpl.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{tpl.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tpl.definition.nodes.map((n: any, idx: number) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700"
                    >
                      {n.label || n.type}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleUseTemplate(tpl.id)}
                disabled={!userCanEdit}
                title={!userCanEdit ? 'Insufficient permissions to instantiate templates' : undefined}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Use This Template →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RunBanner({ run, onClose }: { run: PipelineRun; onClose: () => void }) {
  const nodeStats = Object.entries(run.stats || {})
  return (
    <div className="border-b border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            run.status === 'running' ? 'bg-blue-950 text-blue-300 border border-blue-800 animate-pulse' :
            run.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
            run.status === 'failed' ? 'bg-red-950 text-red-300 border border-red-800' :
            'bg-slate-800 text-slate-300'
          }`}>
            {run.status}
          </span>
          <span className="text-xs font-mono text-slate-400">Run {run.id.slice(0, 8)}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {nodeStats.map(([nodeId, stats]) => (
          <div key={nodeId} className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 font-mono">
            {nodeId}: <span className="text-slate-300 font-bold">{stats.received} in</span> → <span className="text-emerald-400 font-bold">{stats.produced} out</span>
            {stats.errors > 0 && <span className="text-red-400"> ({stats.errors} err)</span>}
          </div>
        ))}
      </div>
      {run.log && run.log.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto bg-slate-900 rounded p-2 text-xs font-mono text-slate-400 border border-slate-800">
          {run.log.slice(-8).map((entry, i) => (
            <div key={i} className={entry.level === 'error' ? 'text-red-400' : entry.level === 'warn' ? 'text-amber-400' : ''}>
              <span className="text-slate-600">{new Date(entry.ts).toLocaleTimeString()}</span> {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
