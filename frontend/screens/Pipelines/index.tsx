'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import { PipelineEditor } from './PipelineEditor'
import type { NodeTypeDescriptor, PipelineDefinition, PipelineNode, NodeEdge, PipelineRun } from '../../../shared/types/pipeline.types'

export function Pipelines() {
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([])
  const [nodeTypes, setNodeTypes] = useState<NodeTypeDescriptor[]>([])
  const [selected, setSelected] = useState<PipelineDefinition | null>(null)
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [pipelineRes, nodeRes] = await Promise.all([
        api.pipelines.list(),
        api.pipelines.nodeTypes(),
      ])
      setPipelines((pipelineRes as any).pipelines)
      setNodeTypes((nodeRes as any).types)
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

  const handleRun = useCallback(async () => {
    if (!selected) return
    try {
      await handleSave(selected.nodes, selected.edges)
      const res = await api.pipelines.run(selected.id, {}) as any
      const runId = res.runId
      // Poll for run status
      const poll = async () => {
        try {
          const run = await api.pipelines.getRun(runId) as any
          setActiveRun(run)
          if (run.status === 'running' || run.status === 'paused') {
            setTimeout(poll, 2000)
          } else {
            loadRuns(selected.id)
          }
        } catch { /* ignore poll errors */ }
      }
      poll()
    } catch (err) {
      console.error('Failed to run pipeline:', err)
      alert('Failed to start pipeline run.')
    }
  }, [selected, handleSave, loadRuns])

  const handleCreate = async () => {
    try {
      const res = await api.pipelines.create({
        name: 'New Pipeline',
        collection: 'leads',
        status: 'draft',
        nodes: [],
        edges: [],
      }) as any
      setPipelines(prev => [...prev, res])
      handleSelect(res)
    } catch (err) {
      console.error('Failed to create pipeline:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pipeline? This cannot be undone.')) return
    try {
      await api.pipelines.delete(id)
      setPipelines(prev => prev.filter(p => p.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      console.error('Failed to delete pipeline:', err)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Loading pipelines...</div>
  }

  if (selected) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 hover:text-slate-200 text-sm"
            >
              ← Back to list
            </button>
            <h1 className="text-lg font-semibold text-white">{selected.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              selected.status === 'active' ? 'bg-emerald-900 text-emerald-300' :
              selected.status === 'paused' ? 'bg-amber-900 text-amber-300' :
              'bg-slate-700 text-slate-300'
            }`}>
              {selected.status}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeRun && (
            <RunBanner run={activeRun} onClose={() => setActiveRun(null)} />
          )}
          <PipelineEditor
            pipeline={selected}
            nodeTypes={nodeTypes}
            onSave={handleSave}
            onRun={handleRun}
          />
        </div>

        {runs.length > 0 && (
          <div className="border-t border-slate-800 bg-slate-900 p-3 max-h-48 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Recent Runs</h3>
            <div className="space-y-1">
              {runs.slice(0, 10).map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{new Date(r.started_at).toLocaleString()}</span>
                  <span className={`font-medium ${
                    r.status === 'completed' ? 'text-emerald-400' :
                    r.status === 'failed' ? 'text-red-400' :
                    r.status === 'running' ? 'text-blue-400' :
                    'text-slate-400'
                  }`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipelines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Build node-graph pipelines to scrape, process, and act on data from any source.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium"
        >
          + New Pipeline
        </button>
      </div>

      <div className="grid gap-3">
        {pipelines.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No pipelines yet. Create one to get started.
          </div>
        )}
        {pipelines.map(p => (
          <div
            key={p.id}
            className="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer group"
            onClick={() => handleSelect(p)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium text-white group-hover:text-emerald-400">{p.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'active' ? 'bg-emerald-900 text-emerald-300' :
                    p.status === 'paused' ? 'bg-amber-900 text-amber-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="text-sm text-slate-400 mt-1 truncate">{p.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{p.nodes.length} nodes</span>
                  <span>•</span>
                  <span>{p.edges.length} connections</span>
                  <span>•</span>
                  <span>collection: {p.collection}</span>
                  <span>•</span>
                  <span>updated {new Date(p.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                className="text-slate-600 hover:text-red-400 text-sm px-2"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RunBanner({ run, onClose }: { run: PipelineRun; onClose: () => void }) {
  const nodeStats = Object.entries(run.stats || {})
  return (
    <div className="border-b border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            run.status === 'running' ? 'bg-blue-900 text-blue-300 animate-pulse' :
            run.status === 'completed' ? 'bg-emerald-900 text-emerald-300' :
            run.status === 'failed' ? 'bg-red-900 text-red-300' :
            'bg-slate-700 text-slate-300'
          }`}>
            {run.status}
          </span>
          <span className="text-xs text-slate-400">Run {run.id.slice(0, 8)}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {nodeStats.map(([nodeId, stats]) => (
          <div key={nodeId} className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
            {nodeId}: <span className="text-slate-300">{stats.received} in</span> → <span className="text-emerald-400">{stats.produced} out</span>
            {stats.errors > 0 && <span className="text-red-400"> ({stats.errors} err)</span>}
          </div>
        ))}
      </div>
      {run.log && run.log.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto bg-slate-900 rounded p-2 text-xs font-mono text-slate-400">
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
