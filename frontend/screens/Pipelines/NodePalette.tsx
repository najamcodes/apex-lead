import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import type { NodeTypeDescriptor, PipelineDefinition } from '@sdk/core/types'
import { Layers } from 'lucide-react'

interface NodePaletteProps {
  nodeTypes: NodeTypeDescriptor[]
  onAddNode: (descriptor: NodeTypeDescriptor, position: { x: number; y: number }, customConfig?: Record<string, unknown>, customLabel?: string) => void
  currentPipelineId?: string
}

const CATEGORIES = ['Trigger', 'Source', 'Process', 'Transform', 'Logic', 'Storage', 'Output', 'Notify', 'Custom', 'Advanced'] as const

export function NodePalette({ nodeTypes, onAddNode, currentPipelineId }: NodePaletteProps) {
  const [subPipelines, setSubPipelines] = useState<PipelineDefinition[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('leadhunter:palette_expanded')
      if (saved) return new Set(JSON.parse(saved))
    } catch {}
    return new Set(['Trigger', 'Source', 'Process', 'Transform', 'Custom', 'Sub-Workflows'])
  })

  useEffect(() => {
    api.pipelines.list().then(res => {
      setSubPipelines((res.pipelines || []).filter(p => p.id !== currentPipelineId))
    }).catch(() => {})
  }, [currentPipelineId])

  const filtered = nodeTypes.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
  )

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      try {
        localStorage.setItem('leadhunter:palette_expanded', JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none">
      <div className="p-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200 mb-2 flex items-center justify-between">
          <span>Node Palette</span>
          <span className="text-xs font-normal text-slate-500">{nodeTypes.length} types</span>
        </h2>
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {CATEGORIES.map((cat) => {
          const nodes = filtered.filter(n => n.category === cat)
          if (nodes.length === 0) return null
          const isExpanded = expanded.has(cat)
          return (
            <div key={cat} className="border-b border-slate-800/80">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{cat}</span>
                  <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded-full text-[10px]">
                    {nodes.length}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                  {nodes.map((node) => (
                    <button
                      key={node.type}
                      onClick={() => onAddNode(node, { x: 200 + Math.random() * 150, y: 150 + Math.random() * 150 })}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/reactflow', node.type)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className="w-full flex items-start gap-2 p-2 rounded-md hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 text-left group transition-all"
                    >
                      <div
                        className="w-3.5 h-3.5 rounded mt-0.5 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: node.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                            {node.name}
                          </span>
                          {node.isStart && (
                            <span className="px-1 py-0.2 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded text-[9px]">
                              start
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                          {node.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Reusable Sub-Workflows / Custom Components */}
        {subPipelines.length > 0 && (
          <div className="border-b border-slate-800/80">
            <button
              onClick={() => toggleCategory('Sub-Workflows')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-indigo-300">Sub-Workflows</span>
                <span className="px-1.5 py-0.2 bg-slate-800 text-indigo-300 rounded-full text-[10px]">
                  {subPipelines.length}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">{expanded.has('Sub-Workflows') ? '▼' : '▶'}</span>
            </button>
            {expanded.has('Sub-Workflows') && (
              <div className="px-2 pb-2 space-y-1">
                {subPipelines.map((sub) => {
                  const subDesc = nodeTypes.find(n => n.type === 'subworkflow')
                  if (!subDesc) return null
                  return (
                    <button
                      key={sub.id}
                      onClick={() => onAddNode(
                        subDesc,
                        { x: 200 + Math.random() * 150, y: 150 + Math.random() * 150 },
                        { sub_pipeline_id: sub.id },
                        `Sub: ${sub.name}`
                      )}
                      className="w-full flex items-start gap-2 p-2 rounded-md hover:bg-indigo-950/40 border border-transparent hover:border-indigo-800/60 text-left group transition-all"
                    >
                      <div className="w-3.5 h-3.5 rounded mt-0.5 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm bg-indigo-500">
                        <Layers className="w-2.5 h-2.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-indigo-200 truncate block">
                          {sub.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {sub.nodes?.length || 0} nodes • {sub.collection}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-2.5 border-t border-slate-800 text-[11px] text-slate-500 text-center bg-slate-900/60">
        Drag onto canvas or click to add
      </div>
    </div>
  )
}
