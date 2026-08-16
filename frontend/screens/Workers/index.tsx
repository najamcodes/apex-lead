'use client'

import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import type { WorkerNodeSummary, WorkerFarmSummary } from '../../services/api.interface'
import {
  Server,
  Activity,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Laptop,
  Copy,
  Check,
  Sliders
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function WorkersScreen() {
  const [workers, setWorkers] = useState<WorkerNodeSummary[]>([])
  const [summary, setSummary] = useState<WorkerFarmSummary>({ total: 0, online: 0, busy: 0, idle: 0 })
  const [loading, setLoading] = useState(true)
  const [pairingToken, setPairingToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)

  // Local desktop node settings (for Electron users)
  const [localForm, setLocalForm] = useState({
    enabled: false,
    serverUrl: 'http://localhost:4000',
    workerName: '',
    maxConcurrency: 2,
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.workers.list()
      setWorkers(res.workers || [])
      setSummary(res.summary || { total: 0, online: 0, busy: 0, idle: 0 })

      // Check if running on electron to get local worker config
      try {
        const local = await api.workers.getLocalStatus()
        if (local && local.config) {
          setLocalForm({
            enabled: local.config.enabled || false,
            serverUrl: local.config.serverUrl || 'http://localhost:4000',
            workerName: local.config.workerName || '',
            maxConcurrency: local.config.maxConcurrency || 2,
          })
        }
      } catch {}
    } catch (err: any) {
      toast.error(`Failed to load worker farm: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleGenerateToken = async () => {
    try {
      const res = await api.workers.generateToken()
      setPairingToken(res.token)
      setShowPairModal(true)
    } catch (err: any) {
      toast.error(`Failed to generate pairing token: ${err?.message || err}`)
    }
  }

  const handleCopyToken = () => {
    if (!pairingToken) return
    navigator.clipboard.writeText(pairingToken)
    setCopiedToken(true)
    toast.success('Pairing token copied to clipboard')
    setTimeout(() => setCopiedToken(false), 2000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this worker node?')) return
    try {
      await api.workers.delete(id)
      toast.success('Worker removed')
      loadData()
    } catch (err: any) {
      toast.error(`Failed to delete worker: ${err?.message || err}`)
    }
  }

  const handleSaveLocalConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.workers.saveLocalConfig(localForm)
      toast.success('Local worker configuration updated')
      setShowConfigModal(false)
      loadData()
    } catch (err: any) {
      toast.error(`Failed to save configuration: ${err?.message || err}`)
    }
  }

  const handleToggleLocal = async () => {
    try {
      const nextEnabled = !localForm.enabled
      setLocalForm(prev => ({ ...prev, enabled: nextEnabled }))
      await api.workers.saveLocalConfig({ enabled: nextEnabled })
      toast.success(nextEnabled ? 'Worker Farm Mode activated' : 'Worker Farm Mode disabled')
      loadData()
    } catch (err: any) {
      toast.error(`Failed to toggle worker mode: ${err?.message || err}`)
    }
  }

  const getPlatformIcon = (_platform: string) => {
    return <Laptop className="w-4 h-4 text-slate-400" />
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
      case 'idle':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online (Idle)
          </span>
        )
      case 'busy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Busy
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Offline
          </span>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-slate-800 px-8 py-6 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Server className="w-7 h-7 text-emerald-400" />
                Desktop Worker Farm
              </h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Distributed Execution
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Manage child desktop instances that execute Google Maps scraping and automation pipelines using residential IPs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              title="Refresh Farm Status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Sliders className="w-4 h-4" />
              Configure This Node
            </button>
            <button
              onClick={handleGenerateToken}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Connect Desktop App
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Nodes</span>
              <Server className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
            <span className="text-xs text-slate-500">Registered across org</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Online & Active</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.online}</p>
            <span className="text-xs text-emerald-500/80">Ready to accept jobs</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Currently Busy</span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.busy}</p>
            <span className="text-xs text-amber-500/80">Running scraping / pipelines</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Idle Capacity</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{summary.idle}</p>
            <span className="text-xs text-cyan-500/80">Available worker slots</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Laptop className="w-5 h-5 text-emerald-400" />
              Connected Desktop Worker Nodes
            </h2>
            <span className="text-xs text-slate-400">
              Auto load-balanced when selecting "Desktop Farm" on pipeline execution
            </span>
          </div>

          {workers.length === 0 ? (
            <div className="p-12 text-center">
              <Server className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-300 mb-1">No Desktop Workers Connected</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Connect your desktop application to start using residential IPs for Google Maps scraping and distributed pipeline execution.
              </p>
              <button
                onClick={handleGenerateToken}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Connect This Machine
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                      {getPlatformIcon(worker.platform)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-medium text-white text-sm">{worker.name}</h3>
                        {getStatusBadge(worker.status)}
                        <span className="text-xs text-slate-500 font-mono">
                          {worker.platform} • v{worker.version || '1.0'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>ID: <code className="text-slate-500 font-mono">{worker.id.slice(0, 8)}...</code></span>
                        <span>•</span>
                        <span>IP: {worker.ip_address || 'Localhost / Residential'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-slate-500" />
                          Concurrency: <strong className="text-slate-300">{worker.active_jobs} / {worker.max_concurrency} jobs</strong>
                        </span>
                        {worker.last_heartbeat_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              Seen {new Date(worker.last_heartbeat_at).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Capabilities */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {worker.capabilities.map((cap, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60"
                          >
                            {cap.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(worker.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-colors"
                      title="Remove Worker Node"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pairing Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              Pair Desktop App to Farm
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Use this token in your desktop app's <strong>Settings &gt; Worker Farm</strong> tab to join this organization's scraping farm.
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg mb-4 flex items-center justify-between">
              <code className="text-xs text-emerald-400 font-mono break-all line-clamp-3">
                {pairingToken}
              </code>
              <button
                onClick={handleCopyToken}
                className="ml-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors shrink-0"
                title="Copy Token"
              >
                {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPairModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              Desktop Farm Node Configuration
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Configure this desktop machine to act as a worker node for your organization.
            </p>

            <form onSubmit={handleSaveLocalConfig} className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <div className="font-medium text-sm text-white">Enable Worker Farm Mode</div>
                  <div className="text-xs text-slate-400">Accept remote scraping and pipeline tasks</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLocal}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    localForm.enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Central Server URL</label>
                <input
                  type="text"
                  value={localForm.serverUrl}
                  onChange={(e) => setLocalForm({ ...localForm, serverUrl: e.target.value })}
                  placeholder="http://localhost:4000 or https://api.yourdomain.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Worker Node Name</label>
                <input
                  type="text"
                  value={localForm.workerName}
                  onChange={(e) => setLocalForm({ ...localForm, workerName: e.target.value })}
                  placeholder="e.g. Office Desktop PC"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Max Concurrent Tasks ({localForm.maxConcurrency})
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={localForm.maxConcurrency}
                  onChange={(e) => setLocalForm({ ...localForm, maxConcurrency: parseInt(e.target.value, 10) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
