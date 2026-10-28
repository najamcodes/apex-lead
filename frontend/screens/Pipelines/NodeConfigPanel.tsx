'use client'

import { useState, useEffect } from 'react'
import type { NodeTypeDescriptor, PipelineNode } from '@sdk/core/types'
import { api } from '../../services/api'
import type { AIConnectionProfile } from '../../services/api.interface'

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
  const [aiConnections, setAiConnections] = useState<AIConnectionProfile[]>([])

  useEffect(() => {
    setLabel(node.label)
    setConfig(node.config)
  }, [node.id, node.label, node.config])

  useEffect(() => {
    // Load available AI connection profiles for nodes with AI capabilities
    api.aiConnections.list().then(res => {
      if (res.data) setAiConnections(res.data)
    }).catch(() => {})
  }, [])

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

        {/* Webhook URL Helper for Webhook Triggers */}
        {node.type === 'trigger' && config.type === 'webhook' && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-md text-xs space-y-1.5">
            <div className="flex items-center justify-between text-emerald-400 font-medium">
              <span>Webhook Trigger Endpoint</span>
              <span className="text-[10px] uppercase tracking-wider bg-emerald-900/60 px-1.5 py-0.5 rounded">POST</span>
            </div>
            <div className="font-mono text-[11px] bg-slate-950/80 p-2 rounded border border-emerald-900/50 text-emerald-300 break-all select-all">
              {`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000'}/api/pipelines/webhook/${config.webhook_slug || 'your-slug'}`}
            </div>
            <p className="text-[11px] text-slate-400">
              Send an HTTP POST request with JSON body to this URL to trigger this pipeline immediately.
            </p>
          </div>
        )}

        {/* Help */}
        {descriptor?.help && (
          <div className="p-2.5 bg-slate-800/80 rounded text-xs text-slate-400 border border-slate-700 whitespace-pre-line leading-relaxed">
            💡 {descriptor.help}
          </div>
        )}

        {/* Config fields */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Configuration</h4>
          {descriptor && Object.entries(descriptor.configSchema).map(([key, schema]) => {
            const fieldSchema = { ...(schema as ConfigFieldSchema) }

            // Dynamically inject AI connection options
            if (key === 'ai_connection_id') {
              fieldSchema.options = [
                { label: 'Default (From Settings)', value: '' },
                ...aiConnections.map(c => ({
                  label: `${c.name} (${c.provider}${c.default_model ? ` / ${c.default_model}` : ''})${c.is_default ? ' [Default]' : ''}`,
                  value: c.id,
                }))
              ]
            }

            return (
              <ConfigField
                key={key}
                fieldKey={key}
                schema={fieldSchema}
                value={config[key]}
                onChange={(value) => handleFieldChange(key, value)}
              />
            )
          })}
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

interface SelectOption {
  label: string
  value: string
}

interface ConfigFieldSchema {
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'json'
  label: string
  required?: boolean
  description?: string
  default?: unknown
  options?: Array<string | SelectOption>
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
          {(schema.options ?? []).map(opt => {
            const optValue = typeof opt === 'string' ? opt : opt.value
            const optLabel = typeof opt === 'string' ? opt : opt.label
            return (
              <option key={optValue} value={optValue}>{optLabel}</option>
            )
          })}
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
