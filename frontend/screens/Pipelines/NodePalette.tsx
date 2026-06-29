'use client'

import { useState } from 'react'
import type { NodeTypeDescriptor } from '../../../shared/types/pipeline.types'

interface NodePaletteProps {
  nodeTypes: NodeTypeDescriptor[]
  onAddNode: (descriptor: NodeTypeDescriptor, position: { x: number; y: number }) => void
}

const CATEGORIES = ['Trigger', 'Source', 'Process', 'Logic', 'Storage', 'Output', 'Advanced'] as const

export function NodePalette({ nodeTypes, onAddNode }: NodePaletteProps) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Source', 'Process']))

  const filtered = nodeTypes.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
  )

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">Node Types</h2>
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {CATEGORIES.map((cat) => {
          const nodes = filtered.filter(n => n.category === cat)
          if (nodes.length === 0) return null
          const isExpanded = expanded.has(cat)
          return (
            <div key={cat} className="border-b border-slate-800">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                {cat}
                <span>{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                  {nodes.map((node) => (
                    <button
                      key={node.type}
                      onClick={() => onAddNode(node, { x: 200 + Math.random() * 200, y: 150 + Math.random() * 200 })}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/reactflow', node.type)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className="w-full flex items-start gap-2 p-2 rounded hover:bg-slate-800 text-left group"
                    >
                      <div
                        className="w-3 h-3 rounded mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: node.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-slate-200 group-hover:text-white truncate">{node.name}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{node.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500">
        Drag or click to add a node
      </div>
    </div>
  )
}
