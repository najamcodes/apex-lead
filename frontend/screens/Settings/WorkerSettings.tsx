'use client'

import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { Server, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export function WorkerSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [form, setForm] = useState({
    enabled: false,
    serverUrl: 'http://localhost:4000',
    workerName: '',
    pairingToken: '',
    maxConcurrency: 2,
  })

  const loadStatus = async () => {
    try {
      setLoading(true)
      const res = await api.workers.getLocalStatus()
      setStatus(res)
      if (res && res.config) {
        setForm({
          enabled: res.config.enabled || false,
          serverUrl: res.config.serverUrl || 'http://localhost:4000',
          workerName: res.config.workerName || '',
          pairingToken: res.config.pairingToken || '',
          maxConcurrency: res.config.maxConcurrency || 2,
        })
      }
    } catch (err: any) {
      console.warn('Could not load local worker status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      let parsedOrgId = 1
      let parsedUserId: number | undefined

      if (form.pairingToken) {
        try {
          const decoded = JSON.parse(atob(form.pairingToken))
          if (decoded.org_id) parsedOrgId = decoded.org_id
          if (decoded.user_id) parsedUserId = decoded.user_id
        } catch {}
      }

      await api.workers.saveLocalConfig({
        ...form,
        orgId: parsedOrgId,
        userId: parsedUserId,
      })

      toast.success('Worker Farm settings saved')
      loadStatus()
    } catch (err: any) {
      toast.error(`Failed to save worker settings: ${err?.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    const next = !form.enabled
    setForm(prev => ({ ...prev, enabled: next }))
    try {
      await api.workers.saveLocalConfig({ enabled: next })
      toast.success(next ? 'Worker node activated' : 'Worker node deactivated')
      loadStatus()
    } catch (err: any) {
      toast.error(`Error toggling worker: ${err?.message || err}`)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            Desktop Worker Farm Mode
          </h2>
          <p className="text-sm text-slate-400">
            Allow this desktop app to act as a worker node, accepting remote scraping and pipeline tasks from your central web dashboard.
          </p>
        </div>

        <button
          onClick={loadStatus}
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded-lg"
          title="Refresh Status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Connection Status Banner */}
      <div className="p-4 rounded-xl border bg-slate-900 border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            status?.connected ? 'bg-emerald-400 animate-pulse' : (form.enabled ? 'bg-amber-400' : 'bg-slate-600')
          }`} />
          <div>
            <div className="font-medium text-sm text-white">
              {status?.connected
                ? 'Connected to Central Orchestrator'
                : (form.enabled ? 'Connecting to Server...' : 'Worker Mode Inactive (Standalone App)')}
            </div>
            <div className="text-xs text-slate-400">
              {status?.connected
                ? `Node ID: ${status.config?.workerId?.slice(0, 8)}... | Active Tasks: ${status.activeJobs || 0}`
                : 'Enable below to start processing remote jobs with this machine.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
            form.enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-white shadow-md" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Central Web Backend URL
          </label>
          <input
            type="text"
            value={form.serverUrl}
            onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
            placeholder="http://localhost:4000 or https://api.leadhunter.app"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            The WebSocket address of the central orchestrator backend.
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Worker Node Name
          </label>
          <input
            type="text"
            value={form.workerName}
            onChange={(e) => setForm({ ...form, workerName: e.target.value })}
            placeholder="e.g. Najam's Home Windows PC"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Organization Pairing Token (Optional)
          </label>
          <input
            type="password"
            value={form.pairingToken}
            onChange={(e) => setForm({ ...form, pairingToken: e.target.value })}
            placeholder="Paste pairing token generated from the Web Dashboard..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            Generated from the "Worker Farm" screen on your web dashboard to link this machine to your organization.
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Maximum Concurrent Tasks ({form.maxConcurrency})
          </label>
          <input
            type="range"
            min="1"
            max="5"
            value={form.maxConcurrency}
            onChange={(e) => setForm({ ...form, maxConcurrency: parseInt(e.target.value, 10) })}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>1 task (Lightweight)</span>
            <span>3 tasks (Recommended)</span>
            <span>5 tasks (Heavy Workstation)</span>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
