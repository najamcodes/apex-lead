// frontend/screens/Settings/CustomNodesManager.tsx
// User interface for creating, testing, and managing user-made custom nodes & plugins.

import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import type { CustomNode } from '../../services/api.interface'
import { useAuthStore, canManagePlugins } from '../../store/auth.store'
import {
  Code2,
  Plus,
  Trash2,
  Edit2,
  Play,
  RefreshCw,
  Terminal,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_CODE_TEMPLATE = `// Custom Node Execution Handler
// Available globals: ctx, input, incoming, config, log(level, msg), emit(rec), console.log()

const record = incoming[0]?.data || input;

// Example: Score or transform incoming record
const score = (record.rating || 0) * 20;
const enrichedData = {
  ...record,
  custom_calculated_score: score,
  is_high_value: score >= 80,
  processed_at: new Date().toISOString(),
};

log('info', 'Calculated custom score: ' + score);

// Emit the transformed record downstream
emit({
  id: 'custom-' + Date.now(),
  collection: incoming[0]?.collection || 'custom_records',
  data: enrichedData,
  meta: incoming[0]?.meta || { trace: [] }
});
`

export function CustomNodesManager() {
  const [nodes, setNodes] = useState<CustomNode[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<CustomNode | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Custom')
  const [color, setColor] = useState('#6366f1')
  const [code, setCode] = useState(DEFAULT_CODE_TEMPLATE)
  const [saving, setSaving] = useState(false)

  // Testing sandbox state
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testingNode, setTestingNode] = useState<CustomNode | null>(null)
  const [testInput, setTestInput] = useState(JSON.stringify({ business_name: 'Apex Dental', rating: 4.8, city: 'Denver' }, null, 2))
  const [testOutput, setTestOutput] = useState<{ ok: boolean; durationMs?: number; emitted?: any[]; logs?: any[]; error?: string } | null>(null)
  const [executingTest, setExecutingTest] = useState(false)

  const { role, permissions } = useAuthStore()
  const userCanManage = canManagePlugins(role, permissions)

  const loadNodes = async () => {
    try {
      setLoading(true)
      const res = await api.customNodes.list()
      if (res.data) setNodes(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNodes()
  }, [])

  const openNewModal = () => {
    setEditingNode(null)
    setName('')
    setDescription('')
    setCategory('Custom')
    setColor('#6366f1')
    setCode(DEFAULT_CODE_TEMPLATE)
    setModalOpen(true)
  }

  const openEditModal = (n: CustomNode) => {
    setEditingNode(n)
    setName(n.name)
    setDescription(n.description || '')
    setCategory(n.category || 'Custom')
    setColor(n.color || '#6366f1')
    setCode(n.code)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      toast.error('Name and JavaScript code are required')
      return
    }

    try {
      setSaving(true)
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || 'Custom',
        color,
        code: code.trim(),
      }

      if (editingNode) {
        await api.customNodes.update(editingNode.id, payload)
        toast.success(`Updated custom node "${name}"`)
      } else {
        await api.customNodes.create(payload)
        toast.success(`Created custom node "${name}"`)
      }

      setModalOpen(false)
      loadNodes()
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, nodeName: string) => {
    if (!confirm(`Are you sure you want to delete custom node "${nodeName}"?`)) return
    try {
      await api.customNodes.delete(id)
      toast.success(`Deleted "${nodeName}"`)
      loadNodes()
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`)
    }
  }

  const openTester = (n: CustomNode) => {
    setTestingNode(n)
    setTestOutput(null)
    setTestModalOpen(true)
  }

  const runTest = async () => {
    if (!testingNode) return
    try {
      setExecutingTest(true)
      let parsedInput = {}
      try {
        parsedInput = JSON.parse(testInput)
      } catch {
        toast.error('Invalid JSON input format')
        return
      }

      const res = await api.customNodes.test(testingNode.id, { input: parsedInput })
      setTestOutput(res)
      if (res.ok) {
        toast.success(`Node executed successfully in ${res.durationMs}ms!`)
      } else {
        toast.error(`Execution error: ${res.error}`)
      }
    } catch (err: any) {
      setTestOutput({ ok: false, error: err.message })
      toast.error(`Test failed: ${err.message}`)
    } finally {
      setExecutingTest(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            Custom Nodes & User Plugins
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Create custom JavaScript nodes and reusable plugins with access control. These appear in the Pipeline Editor palette.
          </p>
        </div>

        {userCanManage && (
          <button
            type="button"
            onClick={openNewModal}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Node</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Loading custom nodes...</span>
        </div>
      ) : nodes.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-zinc-800 text-center space-y-2 bg-zinc-900/30">
          <p className="text-xs text-zinc-400">No custom nodes created yet for this organization.</p>
          <p className="text-[11px] text-zinc-500">
            Click "+ Create Custom Node" to write custom logic, transform data, or build specialized processors.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: node.color || '#6366f1' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100 truncate">{node.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase text-indigo-300 bg-indigo-950/60 border border-indigo-800/60">
                      {node.category || 'Custom'}
                    </span>
                  </div>
                  {node.description && (
                    <p className="text-xs text-zinc-400 truncate max-w-md mt-0.5">{node.description}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openTester(node)}
                  title="Test node execution in sandbox"
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded text-xs flex items-center gap-1 transition-all"
                >
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span className="text-[11px] font-medium">Test Sandbox</span>
                </button>

                {userCanManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(node)}
                      title="Edit custom node"
                      className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(node.id, node.name)}
                      title="Delete custom node"
                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Creating / Editing Custom Node */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span>{editingNode ? 'Edit Custom Node' : 'Create Custom Node / Plugin'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Node Display Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Custom Lead Scorer"
                    className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Custom, AI, Transform, Logic"
                    className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short explanation of what this node does"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-zinc-400 font-medium">JavaScript Execution Logic *</label>
                  <span className="text-[10px] text-zinc-500 font-mono">Runs inside safe async sandbox</span>
                </div>
                <textarea
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 rounded bg-zinc-950 border border-zinc-800 text-emerald-300 font-mono text-[11px] leading-relaxed outline-none focus:border-indigo-500"
                />
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
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingNode ? 'Save Changes' : 'Register Custom Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Testing Custom Node Sandbox */}
      {testModalOpen && testingNode && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Test Sandbox: {testingNode.name}</span>
              </h3>
              <button onClick={() => setTestModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Sample Record Input (JSON)</label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-[11px] outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={runTest}
                  disabled={executingTest}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${executingTest ? 'animate-spin' : ''}`} />
                  <span>{executingTest ? 'Executing...' : 'Run Test'}</span>
                </button>
              </div>

              {testOutput && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-300">Execution Result:</span>
                    {testOutput.durationMs !== undefined && (
                      <span className="font-mono text-[10px] text-zinc-500">{testOutput.durationMs}ms</span>
                    )}
                  </div>

                  {testOutput.ok ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-40">
                        <div className="text-zinc-400 font-bold mb-1">Emitted Downstream Records:</div>
                        <pre>{JSON.stringify(testOutput.emitted, null, 2)}</pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] font-mono">
                      Error: {testOutput.error}
                    </div>
                  )}

                  {testOutput.logs && testOutput.logs.length > 0 && (
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-400 max-h-28 overflow-y-auto space-y-0.5">
                      <div className="text-zinc-500 font-semibold mb-0.5">Execution Logs:</div>
                      {testOutput.logs.map((l, idx) => (
                        <div key={idx} className={l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-400' : 'text-zinc-400'}>
                          [{l.level.toUpperCase()}] {l.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
