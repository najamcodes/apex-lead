// frontend/screens/Settings/BackendServerSettings.tsx
// High-grade UI panel for configuring, testing, and managing the backend server connection.

import { useState, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { useServerConfigStore } from '../../store/server-config.store'
import {
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Globe,
  Radio,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

export function BackendServerSettings() {
  const {
    serverUrl,
    autoStartLocal,
    isRemote,
    healthStatus,
    latencyMs,
    lastChecked,
    errorMessage,
    isTesting,
    isSaving,
    init,
    testConnection,
    saveConfig,
    restartLocalServer,
  } = useServerConfigStore()

  const [inputUrl, setInputUrl] = useState(serverUrl)
  const [autoStart, setAutoStart] = useState(autoStartLocal)
  const [isRestarting, setIsRestarting] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    setInputUrl(serverUrl)
    setAutoStart(autoStartLocal)
  }, [serverUrl, autoStartLocal])

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
    const res = await saveConfig(inputUrl, autoStart)
    if (res.success) {
      toast.success('Backend server configuration saved and applied!')
    } else {
      toast.error(res.error || 'Failed to save configuration')
    }
  }

  const handlePreset = (presetUrl: string) => {
    setInputUrl(presetUrl)
  }

  const handleRestart = async () => {
    setIsRestarting(true)
    try {
      await restartLocalServer()
      toast.success('Local server restarted successfully!')
    } catch (err: any) {
      toast.error(`Restart failed: ${err?.message || err}`)
    } finally {
      setIsRestarting(false)
    }
  }

  const isLocalhost = !isRemote

  return (
    <Card className="border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Backend Server Configuration
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                {isRemote ? 'Remote Host' : 'Local Node'}
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Specify the API & WebSocket server endpoint for pipeline execution and data sync
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          {healthStatus === 'healthy' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Online • {latencyMs !== null ? `${latencyMs}ms` : 'Healthy'}</span>
            </div>
          )}

          {healthStatus === 'checking' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Probing server...</span>
            </div>
          )}

          {healthStatus === 'unhealthy' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              <XCircle className="w-3.5 h-3.5" />
              <span>Unreachable</span>
            </div>
          )}

          {healthStatus === 'idle' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium">
              <Radio className="w-3 h-3" />
              <span>Not Tested</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5 pt-5">
        {/* URL Input & Quick Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Server Endpoint URL (HTTP/HTTPS)</span>
            <span className="text-[11px] text-zinc-500 font-normal">Active: {serverUrl}</span>
          </label>
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 absolute left-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://localhost:4000 or https://api.yourdomain.com"
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-lg text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-zinc-500">Quick presets:</span>
            <button
              type="button"
              onClick={() => handlePreset('http://localhost:4000')}
              className="px-2.5 py-1 text-xs rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60 transition-colors font-mono"
            >
              localhost:4000 (Default)
            </button>
            <button
              type="button"
              onClick={() => handlePreset('http://127.0.0.1:4000')}
              className="px-2.5 py-1 text-xs rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60 transition-colors font-mono"
            >
              127.0.0.1:4000
            </button>
            <button
              type="button"
              onClick={() => handlePreset('http://localhost:5000')}
              className="px-2.5 py-1 text-xs rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60 transition-colors font-mono"
            >
              localhost:5000
            </button>
          </div>
        </div>

        {/* Local Server Settings / Remote Warning */}
        {isLocalhost ? (
          <div className="p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-800/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">Auto-start Local Background Server</p>
                <p className="text-[11px] text-zinc-500">
                  Automatically spawn and manage the embedded Hono API server on desktop launch
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0"
              />
            </div>

            <div className="pt-2 border-t border-zinc-800/40 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Need to reload local database or pipeline nodes?</span>
              <button
                type="button"
                onClick={handleRestart}
                disabled={isRestarting}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRestarting ? 'animate-spin' : ''}`} />
                {isRestarting ? 'Restarting...' : 'Restart Server'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-900/30 text-xs text-blue-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-200">Remote Cloud Server Mode</p>
              <p className="text-blue-400/80 text-[11px] mt-0.5">
                The desktop app will bypass the local embedded backend and direct all pipeline runs, collections, and background workers to the remote host.
              </p>
            </div>
          </div>
        )}

        {/* Error Callout if Unreachable */}
        {errorMessage && healthStatus === 'unhealthy' && (
          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs text-rose-300 flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-rose-200">Connection Error</p>
              <p className="text-rose-400/90 text-[11px] font-mono break-all">{errorMessage}</p>
              <p className="text-zinc-500 text-[11px] pt-1">
                Tip: Verify the server is running, the port matches, and CORS allows desktop connections.
              </p>
            </div>
          </div>
        )}

        {/* Telemetry info bar */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 pt-1">
          <span>Last probe: {lastChecked || 'Not verified yet'}</span>
          <span>Protocol: {inputUrl.startsWith('https://') ? 'Encrypted (HTTPS/WSS)' : 'Standard (HTTP/WS)'}</span>
        </div>

        {/* Actions footer */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-colors disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 text-zinc-400 ${isTesting ? 'animate-pulse' : ''}`} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-lg shadow-emerald-950/50 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save & Apply URL'}
          </button>
        </div>
      </form>
    </Card>
  )
}
