// frontend/components/common/ServerConfigModal.tsx
// Quick-access modal for viewing, testing, and changing the Backend Server URL from anywhere in the app.

import { useState, useEffect } from 'react'
import { useServerConfigStore } from '../../store/server-config.store'
import {
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Globe,
  X,
  Radio,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ServerConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ServerConfigModal({ isOpen, onClose }: ServerConfigModalProps) {
  const {
    serverUrl,
    autoStartLocal,
    isRemote,
    healthStatus,
    latencyMs,
    errorMessage,
    isTesting,
    isSaving,
    testConnection,
    saveConfig,
  } = useServerConfigStore()

  const [inputUrl, setInputUrl] = useState(serverUrl)

  useEffect(() => {
    if (isOpen) {
      setInputUrl(serverUrl)
    }
  }, [isOpen, serverUrl])

  if (!isOpen) return null

  const handleTest = async () => {
    const res = await testConnection(inputUrl)
    if (res.ok) {
      toast.success(`Server reachable! Latency: ${res.latencyMs}ms`)
    } else {
      toast.error(`Connection failed: ${res.error || 'Server unreachable'}`)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await saveConfig(inputUrl, autoStartLocal)
    if (res.success) {
      toast.success('Backend server URL saved and applied!')
      onClose()
    } else {
      toast.error(res.error || 'Failed to save configuration')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                Configure Backend Server
              </h3>
              <p className="text-[11px] text-zinc-400">Set API & WebSocket endpoint</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Status Indicator */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Current Status:</span>
              {healthStatus === 'healthy' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online {latencyMs != null ? `(${latencyMs}ms)` : ''}
                </span>
              )}
              {healthStatus === 'checking' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Probing...
                </span>
              )}
              {healthStatus === 'unhealthy' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
                  <XCircle className="w-3 h-3" />
                  Offline / Error
                </span>
              )}
              {healthStatus === 'idle' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                  <Radio className="w-3 h-3" />
                  Not Tested
                </span>
              )}
            </div>

            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
              {isRemote ? 'Remote' : 'Localhost'}
            </span>
          </div>

          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Backend Endpoint URL
            </label>
            <div className="relative flex items-center">
              <Globe className="w-4 h-4 absolute left-3 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://localhost:4000 or https://api.domain.com"
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-zinc-500">Presets:</span>
            <button
              type="button"
              onClick={() => setInputUrl('http://localhost:4000')}
              className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-mono border border-zinc-700/50 transition-colors"
            >
              localhost:4000
            </button>
            <button
              type="button"
              onClick={() => setInputUrl('http://127.0.0.1:4000')}
              className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-mono border border-zinc-700/50 transition-colors"
            >
              127.0.0.1:4000
            </button>
            <button
              type="button"
              onClick={() => setInputUrl('http://localhost:5000')}
              className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-mono border border-zinc-700/50 transition-colors"
            >
              localhost:5000
            </button>
          </div>

          {/* Error Message if Unhealthy */}
          {errorMessage && healthStatus === 'unhealthy' && (
            <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs text-rose-300">
              <span className="font-semibold">Error: </span>
              <span className="font-mono text-[11px]">{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/50 transition-colors disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 text-zinc-400 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-md shadow-emerald-950/50 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
