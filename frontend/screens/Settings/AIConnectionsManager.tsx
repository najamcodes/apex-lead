// frontend/screens/Settings/AIConnectionsManager.tsx
// Interactive manager for multiple named AI Connection setups (Ollama, LM Studio, OpenAI, Claude, Gateways).

import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import type { AIConnectionProfile } from '../../services/api.interface'
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Star,
  Edit2,
  Server,
  Cpu,
  Zap,
  Globe,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

export function AIConnectionsManager() {
  const [connections, setConnections] = useState<AIConnectionProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConn, setEditingConn] = useState<AIConnectionProfile | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; latency?: number }>>({})

  // Form State
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<AIConnectionProfile['provider']>('ollama')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('llama3.1')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadConnections = async () => {
    try {
      setLoading(true)
      const res = await api.aiConnections.list()
      if (res.data) setConnections(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConnections()
  }, [])

  const openNewModal = () => {
    setEditingConn(null)
    setName('')
    setProvider('ollama')
    setBaseUrl('http://127.0.0.1:11434/v1')
    setApiKey('')
    setDefaultModel('llama3.1')
    setIsDefault(connections.length === 0)
    setModalOpen(true)
  }

  const openEditModal = (conn: AIConnectionProfile) => {
    setEditingConn(conn)
    setName(conn.name)
    setProvider(conn.provider)
    setBaseUrl(conn.base_url || '')
    setApiKey(conn.api_key || '')
    setDefaultModel(conn.default_model || '')
    setIsDefault(conn.is_default)
    setModalOpen(true)
  }

  const handleProviderSelect = (p: AIConnectionProfile['provider']) => {
    setProvider(p)
    if (p === 'ollama' && (!baseUrl || baseUrl.includes('1234'))) {
      setBaseUrl('http://127.0.0.1:11434/v1')
      setDefaultModel('llama3.1')
    } else if (p === 'lmstudio' && (!baseUrl || baseUrl.includes('11434'))) {
      setBaseUrl('http://127.0.0.1:1234/v1')
      setDefaultModel('default')
    } else if (p === 'openai') {
      setBaseUrl('https://api.openai.com/v1')
      setDefaultModel('gpt-4o-mini')
    } else if (p === 'anthropic') {
      setBaseUrl('https://api.anthropic.com/v1')
      setDefaultModel('claude-3-5-sonnet-20241022')
    } else if (p === 'gemini') {
      setBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai')
      setDefaultModel('gemini-1.5-flash')
    } else if (p === 'groq') {
      setBaseUrl('https://api.groq.com/openai/v1')
      setDefaultModel('llama-3.1-8b-instant')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Profile name is required')
      return
    }

    try {
      setSaving(true)
      const payload = {
        name: name.trim(),
        provider,
        base_url: baseUrl.trim() || null,
        api_key: apiKey.trim() || null,
        default_model: defaultModel.trim() || null,
        is_default: isDefault,
      }

      if (editingConn) {
        await api.aiConnections.update(editingConn.id, payload)
        toast.success(`Updated "${name}"`)
      } else {
        await api.aiConnections.create(payload)
        toast.success(`Created AI connection "${name}"`)
      }

      setModalOpen(false)
      loadConnections()
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string, name: string) => {
    try {
      await api.aiConnections.setDefault(id)
      toast.success(`"${name}" is now the default AI connection`)
      loadConnections()
    } catch (err: any) {
      toast.error(`Failed to set default: ${err.message}`)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete AI connection setup "${name}"?`)) return
    try {
      await api.aiConnections.delete(id)
      toast.success(`Deleted "${name}"`)
      loadConnections()
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`)
    }
  }

  const handleTest = async (id: string) => {
    try {
      setTestingId(id)
      setTestResults(prev => ({ ...prev, [id]: undefined as any }))
      const res = await api.aiConnections.test(id)
      if (res.ok) {
        setTestResults(prev => ({
          ...prev,
          [id]: { ok: true, message: `Connected (${res.model})!`, latency: res.latencyMs },
        }))
        toast.success(`AI Connection passed in ${res.latencyMs}ms!`)
      } else {
        setTestResults(prev => ({
          ...prev,
          [id]: { ok: false, message: res.error || 'Failed', latency: res.latencyMs },
        }))
        toast.error(`Connection failed: ${res.error}`)
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [id]: { ok: false, message: err.message || 'Error' },
      }))
      toast.error(`Test failed: ${err.message}`)
    } finally {
      setTestingId(null)
    }
  }

  const getProviderIcon = (p: string) => {
    switch (p) {
      case 'ollama':
        return <Server className="w-4 h-4 text-emerald-400" />
      case 'lmstudio':
        return <Cpu className="w-4 h-4 text-indigo-400" />
      case 'openai':
      case 'anthropic':
      case 'gemini':
      case 'groq':
      case 'openrouter':
        return <Globe className="w-4 h-4 text-sky-400" />
      default:
        return <Zap className="w-4 h-4 text-amber-400" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            AI Connection Setups
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure multiple local or cloud AI models. Any pipeline node can choose a specific setup or use the default.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Setup</span>
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Loading setups...</span>
        </div>
      ) : connections.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-zinc-800 text-center space-y-2 bg-zinc-900/30">
          <p className="text-xs text-zinc-400">No custom AI connection setups yet.</p>
          <p className="text-[11px] text-zinc-500">
            Click "+ Add Setup" to configure Ollama, LM Studio, OpenAI, Claude, or a custom self-hosted gateway.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => {
            const testResult = testResults[conn.id]
            const isTesting = testingId === conn.id

            return (
              <div
                key={conn.id}
                className={`p-3 rounded-lg border transition-all ${
                  conn.is_default
                    ? 'border-emerald-800/80 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 p-1.5 rounded-md bg-zinc-800/80">
                      {getProviderIcon(conn.provider)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100 truncate">{conn.name}</span>
                        {conn.is_default && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            Default
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase text-zinc-400 bg-zinc-800/80 border border-zinc-700">
                          {conn.provider}
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono">
                        {conn.base_url && (
                          <span className="truncate max-w-[240px] text-zinc-500">
                            {conn.base_url}
                          </span>
                        )}
                        {conn.default_model && (
                          <span className="text-indigo-300">
                            model: <span className="font-semibold text-zinc-300">{conn.default_model}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTest(conn.id)}
                      disabled={isTesting}
                      title="Test connection latency and connectivity"
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                      <span className="text-[11px] font-medium">Test</span>
                    </button>

                    {!conn.is_default && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(conn.id, conn.name)}
                        title="Set as global default AI connection"
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 border border-zinc-700 rounded text-xs flex items-center gap-1 transition-all"
                      >
                        <Star className="w-3 h-3" />
                        <span className="text-[11px] font-medium">Make Default</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditModal(conn)}
                      title="Edit setup"
                      className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(conn.id, conn.name)}
                      title="Delete setup"
                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Test Result Indicator */}
                {testResult && (
                  <div
                    className={`mt-2.5 p-2 rounded text-[11px] flex items-center justify-between ${
                      testResult.ok
                        ? 'bg-emerald-950/50 border border-emerald-800/80 text-emerald-300'
                        : 'bg-red-950/50 border border-red-800/80 text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.latency !== undefined && (
                      <span className="font-mono font-bold text-[10px]">{testResult.latency}ms</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal for Creating / Editing AI Connection */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>{editingConn ? 'Edit AI Connection Setup' : 'Add AI Connection Setup'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Profile Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ollama Local Llama 3.1 or Office OpenAI"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">AI Provider *</label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderSelect(e.target.value as any)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-emerald-500"
                >
                  <optgroup label="Local Inference Engines">
                    <option value="ollama">Ollama (Local Server / CLI)</option>
                    <option value="lmstudio">LM Studio (Local GUI Server)</option>
                  </optgroup>
                  <optgroup label="Cloud Providers">
                    <option value="openrouter">OpenRouter (Multi-Model Hub)</option>
                    <option value="openai">OpenAI (GPT-4o / O1)</option>
                    <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
                    <option value="gemini">Google Gemini (Flash / Pro)</option>
                    <option value="groq">Groq (Ultra-Fast Cloud)</option>
                  </optgroup>
                  <optgroup label="Custom Gateways">
                    <option value="custom_openai">Custom OpenAI-Compatible (vLLM / LocalAI)</option>
                    <option value="custom_claude">Custom Claude-Compatible Gateway</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:11434/v1 or https://api.openai.com/v1"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-mono text-[11px] outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">
                  API Key / Token {provider === 'ollama' || provider === 'lmstudio' ? '(Optional for local)' : ''}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'ollama' || provider === 'lmstudio' ? 'Optional token' : 'sk-...'}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Default Model Name</label>
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="e.g. llama3.1, gpt-4o, claude-3-5-sonnet-20241022"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                />
                <label htmlFor="is_default" className="text-zinc-300 select-none cursor-pointer">
                  Set as global default AI setup for pipelines
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingConn ? 'Save Changes' : 'Create Setup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
