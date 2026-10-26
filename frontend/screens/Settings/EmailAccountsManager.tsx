import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { EmailAccount, EmailAccountInsert } from '../../../shared/types'
import { api } from '../../services/api'

export function EmailAccountsManager() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [senderName, setSenderName] = useState('')
  const [dailyLimit, setDailyLimit] = useState('50')

  const loadAccounts = async () => {
    const data = await api.emailAccounts.getAll()
    setAccounts(data)
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleAdd = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const data: EmailAccountInsert = {
        email_address: email,
        app_password: password,
        sender_name: senderName,
        daily_limit: parseInt(dailyLimit, 10) || 50
      }
      await api.emailAccounts.add(data)
      setShowAdd(false)
      setEmail(''); setPassword(''); setSenderName(''); setDailyLimit('50')
      await loadAccounts()
    } catch (err) {
      alert('Failed to add account. Email might already exist.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this email account?')) return
    await api.emailAccounts.delete(id)
    await loadAccounts()
  }

  const handleTest = async (id: number) => {
    const acc = accounts.find(a => a.id === id)
    if (!acc) return

    // Optimistic UI update
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: 'testing' } : a))

    try {
      const res = await api.emailAccounts.test(id)
      if (!res.ok) alert('Test failed: ' + res.error)
      await loadAccounts()
    } catch (err) {
      alert('Error testing account.')
      await loadAccounts()
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700/50 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-400" />
            Email Accounts
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Connect Gmail accounts to enable multi-sender rotation and IMAP reply tracking. Use App Passwords.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Account
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="sales@company.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">App Password (16 chars)</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="xxxx xxxx xxxx xxxx" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Sender Name</label>
            <input required type="text" value={senderName} onChange={e => setSenderName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Daily Limit</label>
            <input required type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} min="1" max="500"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-1 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button disabled={loading} type="button" onClick={handleAdd} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {loading ? 'Adding...' : 'Save Account'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {accounts.length === 0 && !showAdd && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No email accounts added yet.
          </div>
        )}
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{acc.sender_name}</span>
                <span className="text-sm text-gray-400">&lt;{acc.email_address}&gt;</span>
                {acc.status === 'active' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                {acc.status === 'error' && <span title={acc.last_error || 'Error'}><XCircle className="h-4 w-4 text-red-400" /></span>}
                {acc.status === 'testing' && <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-4">
                <span>Sent Today: {acc.sent_today} / {acc.daily_limit}</span>
                {acc.last_error && <span className="text-red-400 truncate max-w-xs" title={acc.last_error}>{acc.last_error}</span>}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => handleTest(acc.id)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                Test Connection
              </button>
              <button onClick={() => handleDelete(acc.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
