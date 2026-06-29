'use client'

import { useState, useEffect } from 'react'
import type { FieldMapping, NodeEdge } from '../../../shared/types/pipeline.types'

interface EdgeMappingPanelProps {
  edge: NodeEdge
  onUpdate: (mappings: FieldMapping[] | undefined, condition?: string) => void
  onClose: () => void
}

export function EdgeMappingPanel({ edge, onUpdate, onClose }: EdgeMappingPanelProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(edge.mappings ?? [])
  const [condition, setCondition] = useState(edge.condition ?? '')
  const [hasMappings, setHasMappings] = useState((edge.mappings?.length ?? 0) > 0)

  useEffect(() => {
    setMappings(edge.mappings ?? [])
    setCondition(edge.condition ?? '')
    setHasMappings((edge.mappings?.length ?? 0) > 0)
  }, [edge.id, edge.mappings, edge.condition])

  const commit = (nextMappings: FieldMapping[], nextCondition?: string) => {
    setMappings(nextMappings)
    onUpdate(hasMappings ? nextMappings : undefined, nextCondition || undefined)
  }

  const addMapping = () => {
    setHasMappings(true)
    const next = [...mappings, { source: '', target: '' }]
    setMappings(next)
    onUpdate(next, condition || undefined)
  }

  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const next = mappings.map((m, i) => i === index ? { ...m, [field]: value } : m)
    commit(next, condition)
  }

  const removeMapping = (index: number) => {
    const next = mappings.filter((_, i) => i !== index)
    commit(next, condition)
    if (next.length === 0) setHasMappings(false)
  }

  const togglePassthrough = () => {
    const next = !hasMappings
    setHasMappings(next)
    if (next && mappings.length === 0) {
      addMapping()
    } else {
      onUpdate(next ? mappings : undefined, condition || undefined)
    }
  }

  const updateCondition = (value: string) => {
    setCondition(value)
    onUpdate(hasMappings ? mappings : undefined, value || undefined)
  }

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Data Mapping</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connection info */}
        <div className="p-2 bg-slate-800 rounded text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">{edge.from}</span>
            <span>→</span>
            <span className="text-slate-300">{edge.to}</span>
          </div>
          <div className="mt-1 text-slate-500">
            Port: {edge.fromPort ?? 'main'} → {edge.toPort ?? 'main'}
          </div>
        </div>

        {/* Pass-through toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Field Mapping</label>
            <button
              onClick={togglePassthrough}
              className={`px-2 py-1 rounded text-xs font-medium ${
                hasMappings ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {hasMappings ? 'Custom mapping' : 'Pass-through (all fields)'}
            </button>
          </div>

          {hasMappings ? (
            <>
              <p className="text-xs text-slate-500">
                Map fields from the source record to named inputs on the destination node.
                Leave a row empty to skip it.
              </p>
              <div className="space-y-2">
                {mappings.map((m, i) => (
                  <div key={i} className="p-2 bg-slate-800 rounded border border-slate-700 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="source field (e.g. business_name)"
                        value={m.source}
                        onChange={(e) => updateMapping(i, 'source', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-500">→</span>
                      <input
                        type="text"
                        placeholder="target field"
                        value={m.target}
                        onChange={(e) => updateMapping(i, 'target', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => removeMapping(i)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="transform (e.g. value.toUpperCase())"
                        value={m.transform ?? ''}
                        onChange={(e) => updateMapping(i, 'transform', e.target.value)}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        placeholder="default value"
                        value={m.default !== undefined ? String(m.default) : ''}
                        onChange={(e) => updateMapping(i, 'default', e.target.value)}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={addMapping}
                  className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 rounded text-xs text-slate-400"
                >
                  + Add mapping
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">
              All fields from the source record are passed through to the destination unchanged.
            </p>
          )}
        </div>

        {/* Branch condition */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="block text-xs font-medium text-slate-300">Condition (optional)</label>
          <p className="text-xs text-slate-500">
            Only records matching this expression travel this edge.
            Uses JS against the record data, e.g. <code className="text-emerald-400">data.ai_site_score &gt;= 70</code>
          </p>
          <input
            type="text"
            placeholder="e.g. data.email !== null"
            value={condition}
            onChange={(e) => updateCondition(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Transform help */}
        <div className="p-2 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700 space-y-1">
          <div className="font-semibold text-slate-300">Transform examples:</div>
          <div><code className="text-emerald-400">value.toUpperCase()</code> — string methods</div>
          <div><code className="text-emerald-400">value * 2</code> — arithmetic</div>
          <div><code className="text-emerald-400">{'Hello {{value}}'}</code> — template</div>
          <div><code className="text-emerald-400">value &amp;&amp; value.length &gt; 0</code> — boolean</div>
        </div>
      </div>
    </div>
  )
}
