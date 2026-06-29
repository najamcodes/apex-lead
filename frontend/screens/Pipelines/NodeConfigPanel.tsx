'use client'

import { useState, useEffect } from 'react'
import type { NodeTypeDescriptor, PipelineNode } from '../../../shared/types/pipeline.types'

interface NodeConfigPanelProps {
  node: PipelineNode
  descriptor?: NodeTypeDescriptor
  onUpdate: (config: Record<string, unknown>, label?: string) => void
  onToggleEnabled: () => void
  onDelete: () => void
  onClose: () => void
}

export function NodeConfigPanel({ node, descriptor, onUpdate, onToggleEnabled, onDelete, onClose }: NodeConfigPanelProps) {
  const [label, setLabel] = useState(node.label)
  const [config, setConfig] = useState<Record<string, unknown>>(node.config)

  useEffect(() => {
    setLabel(node.label)
    setConfig(node.config)
  }, [node.id, node.label, node.config])

  const handleFieldChange = (key: string, value: unknown) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    onUpdate(next, label)
  }

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel)
    onUpdate(config, newLabel)
  }

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Node Config</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Node type badge */}
        <div className="flex items-center gap-2">
          <div
            className="px-2 py-1 rounded text-xs font-medium text-white"
            style={{ backgroundColor: descriptor?.color ?? '#64748b' }}
          >
            {descriptor?.name ?? node.type}
          </div>
          <span className="text-xs text-slate-500">{descriptor?.category}</span>
        </div>

        {/* Description */}
        {descriptor?.description && (
          <p className="text-xs text-slate-400 leading-relaxed">{descriptor.description}</p>
        )}

        {/* Help */}
        {descriptor?.help && (
          <div className="p-2 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700">
            💡 {descriptor.help}
          </div>
        )}

        {/* Config fields */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Configuration</h4>
          {descriptor && Object.entries(descriptor.configSchema).map(([key, schema]) => (
            <ConfigField
              key={key}
              fieldKey={key}
              schema={schema as ConfigFieldSchema}
              value={config[key]}
              onChange={(value) => handleFieldChange(key, value)}
            />
          ))}
          {descriptor && Object.keys(descriptor.configSchema).length === 0 && (
            <p className="text-xs text-slate-500 italic">No configuration needed.</p>
          )}
        </div>

        {/* Port info */}
        {descriptor && (descriptor.inputs.length > 0 || descriptor.outputs.length > 0) && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Ports</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-500 mb-1">Inputs</div>
                {descriptor.inputs.map(p => (
                  <div key={p.id} className="text-slate-300">• {p.label}</div>
                ))}
                {descriptor.inputs.length === 0 && <div className="text-slate-600 italic">none</div>}
              </div>
              <div>
                <div className="text-slate-500 mb-1">Outputs</div>
                {descriptor.outputs.map(p => (
                  <div key={p.id} className="text-slate-300">• {p.label}</div>
                ))}
                {descriptor.outputs.length === 0 && <div className="text-slate-600 italic">none</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={onToggleEnabled}
          className={`w-full px-3 py-2 rounded text-sm font-medium ${
            node.enabled
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {node.enabled ? 'Disable Node' : 'Enable Node'}
        </button>
        <button
          onClick={onDelete}
          className="w-full px-3 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded text-sm font-medium"
        >
          Delete Node
        </button>
      </div>
    </div>
  )
}

interface ConfigFieldSchema {
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'json'
  label: string
  required?: boolean
  description?: string
  default?: unknown
  options?: string[]
}

function ConfigField({ fieldKey, schema, value, onChange }: {
  fieldKey: string
  schema: ConfigFieldSchema
  value: unknown
  onChange: (value: unknown) => void
}) {
  const label = (
    <label className="block text-xs font-medium text-slate-400 mb-1">
      {schema.label} {schema.required && <span className="text-red-400">*</span>}
    </label>
  )

  if (schema.description) {
    return (
      <div>
        {label}
        <p className="text-xs text-slate-500 mb-1">{schema.description}</p>
        <FieldInput fieldKey={fieldKey} schema={schema} value={value} onChange={onChange} />
      </div>
    )
  }
  return (
    <div>
      {label}
      <FieldInput fieldKey={fieldKey} schema={schema} value={value} onChange={onChange} />
    </div>
  )
}

function FieldInput({ schema, value, onChange }: {
  fieldKey: string
  schema: ConfigFieldSchema
  value: unknown
  onChange: (value: unknown) => void
}) {
  const baseClass = "w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-emerald-500"

  switch (schema.type) {
    case 'boolean':
      return (
        <button
          onClick={() => onChange(!value)}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            value ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {value ? 'Enabled' : 'Disabled'}
        </button>
      )
    case 'select':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        >
          <option value="">— Select —</option>
          {(schema.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    case 'text':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className={baseClass + ' font-mono text-xs'}
        />
      )
    case 'json':
      return (
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value ?? (schema.default ?? {}), null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value))
            } catch {
              onChange(e.target.value) // keep raw string while editing
            }
          }}
          rows={6}
          className={baseClass + ' font-mono text-xs'}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          className={baseClass}
        />
      )
    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      )
  }
}
