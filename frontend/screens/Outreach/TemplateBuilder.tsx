import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useTemplatesStore } from '../../store/templates.store'
import type { EmailTemplate } from '../../../shared/types'

export function TemplateBuilder() {
  const { templates, loading, fetchAll, create, update, remove } = useTemplatesStore()
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  
  const [formName, setFormName] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formBody, setFormBody] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  const handleEdit = (tpl: EmailTemplate) => {
    setEditingId(tpl.id)
    setFormName(tpl.name)
    setFormSubject(tpl.subject)
    setFormBody(tpl.body)
  }

  const handleNew = () => {
    setEditingId('new')
    setFormName('')
    setFormSubject('')
    setFormBody('')
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!formName || !formSubject || !formBody) return
    if (editingId === 'new') {
      await create({ name: formName, subject: formSubject, body: formBody })
    } else if (editingId) {
      await update(editingId, { name: formName, subject: formSubject, body: formBody })
    }
    setEditingId(null)
  }

  if (loading && templates.length === 0) {
    return <div className="text-zinc-500 py-10 text-center text-sm">Loading templates...</div>
  }

  if (editingId !== null) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-100">
            {editingId === 'new' ? 'Create Template' : 'Edit Template'}
          </h3>
          <button onClick={handleCancel} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <Input 
          label="Template Name" 
          placeholder="e.g. Initial Cold Outreach" 
          value={formName} 
          onChange={(e) => setFormName(e.target.value)} 
        />
        <Input 
          label="Subject Line" 
          placeholder="e.g. Question about {{business_name}}" 
          value={formSubject} 
          onChange={(e) => setFormSubject(e.target.value)} 
        />
        
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Email Body</label>
          <textarea
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 min-h-[150px]"
            placeholder="Hi, noticed {{business_name}}..."
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
          />
          <p className="text-xs text-zinc-500 mt-1">
            Available variables: <code className="text-emerald-400">{'{{business_name}}'}</code>, <code className="text-emerald-400">{'{{city}}'}</code>
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <Save className="w-3.5 h-3.5" />
            Save Template
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-zinc-900/50 p-4 border border-zinc-800/50 rounded-xl">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Email Templates</h3>
          <p className="text-xs text-zinc-500">Create reusable email sequences</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleNew}>
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col group">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-sm font-medium text-zinc-200 truncate pr-4">{tpl.name}</h4>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(tpl)} className="p-1.5 text-zinc-500 hover:text-blue-400 rounded-lg hover:bg-zinc-800 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(tpl.id)} className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs font-mono text-zinc-400 mb-2 truncate bg-zinc-950 px-2 py-1 rounded">Subj: {tpl.subject}</p>
            <p className="text-xs text-zinc-500 line-clamp-3 mt-1 leading-relaxed">{tpl.body}</p>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-zinc-500">
            No templates created yet.
          </div>
        )}
      </div>
    </div>
  )
}
