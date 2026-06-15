import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { TextArea } from '../../components/ui/TextArea'

export function EmailTemplatesManager() {
  const [templates, setTemplates] = useState<any[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const loadTemplates = async () => {
    const data = await window.api.templates.getAll()
    setTemplates(data)
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleSave = async () => {
    if (!name || !subject || !body) return

    if (editingId) {
      await window.api.templates.update(editingId, { name, subject, body })
    } else {
      await window.api.templates.create({ name, subject, body })
    }

    setEditingId(null)
    setName('')
    setSubject('')
    setBody('')
    await loadTemplates()
  }

  const handleEdit = (t: any) => {
    setEditingId(t.id)
    setName(t.name)
    setSubject(t.subject)
    setBody(t.body)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await window.api.templates.delete(id)
      await loadTemplates()
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setName('')
    setSubject('')
    setBody('')
  }

  return (
    <div className="space-y-4">
      {/* Editor Form */}
      <div className="p-4 rounded-md border border-zinc-800 bg-zinc-900/50 space-y-3">
        <h4 className="text-sm font-medium text-zinc-300">
          {editingId ? 'Edit Template' : 'Create New Template'}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input 
            label="Template Name" 
            placeholder="e.g. Initial Cold Pitch" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
          <Input 
            label="Email Subject" 
            placeholder="e.g. Quick question for {{business_name}}" 
            value={subject} 
            onChange={e => setSubject(e.target.value)} 
          />
        </div>
        <TextArea 
          label="Email Body (supports {{business_name}}, {{city}}, {{ai_hook}} and {Spintax|Options})"
          rows={5}
          placeholder="Hi,\n\nI loved your {{ai_hook}}.\n..."
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <div className="flex items-center gap-2 pt-2">
          <button 
            type="button" 
            onClick={handleSave}
            disabled={!name || !subject || !body}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-md transition-colors disabled:opacity-50"
          >
            {editingId ? 'Save Changes' : 'Add Template'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-md transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {templates.length === 0 && (
          <div className="text-sm text-zinc-500 italic p-4 text-center border border-dashed border-zinc-800 rounded-md">
            No templates created yet.
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} className="flex items-start justify-between p-3 rounded border border-zinc-800 bg-zinc-900/30">
            <div>
              <div className="text-sm font-medium text-zinc-200">{t.name}</div>
              <div className="text-xs text-zinc-500 truncate max-w-md mt-0.5">Subject: {t.subject}</div>
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => handleEdit(t)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Edit
              </button>
              <button 
                type="button" 
                onClick={() => handleDelete(t.id)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
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
