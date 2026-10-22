// frontend/store/server-config.store.ts
// Central state and lifecycle manager for the backend server configuration.

import { create } from 'zustand'
import { api } from '../services/api'
import { getBaseUrl, setBaseUrl } from '../services/pipelines.adapter'
import { wsClient } from '../services/ws-client'

export interface ServerConfigState {
  serverUrl: string
  autoStartLocal: boolean
  isRemote: boolean
  isLocalRunning: boolean
  port: number
  healthStatus: 'idle' | 'checking' | 'healthy' | 'unhealthy'
  latencyMs: number | null
  lastChecked: string | null
  serverInfo: any
  errorMessage: string | null
  isTesting: boolean
  isSaving: boolean

  init: () => Promise<void>
  setServerUrl: (url: string) => void
  setAutoStartLocal: (enabled: boolean) => void
  testConnection: (targetUrl?: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }>
  saveConfig: (newUrl?: string, autoStart?: boolean) => Promise<{ success: boolean; error?: string }>
  restartLocalServer: () => Promise<{ success: boolean; port: number }>
}

function checkIsRemote(url: string): boolean {
  return !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url.trim())
}

export const useServerConfigStore = create<ServerConfigState>((set, get) => ({
  serverUrl: getBaseUrl(),
  autoStartLocal: true,
  isRemote: checkIsRemote(getBaseUrl()),
  isLocalRunning: true,
  port: 4000,
  healthStatus: 'idle',
  latencyMs: null,
  lastChecked: null,
  serverInfo: null,
  errorMessage: null,
  isTesting: false,
  isSaving: false,

  init: async () => {
    try {
      if (api.server?.getConfig) {
        const cfg = await api.server.getConfig()
        const activeUrl = cfg.serverUrl || getBaseUrl()
        setBaseUrl(activeUrl)
        set({
          serverUrl: activeUrl,
          autoStartLocal: cfg.autoStartLocal ?? true,
          isRemote: cfg.isRemote ?? checkIsRemote(activeUrl),
          isLocalRunning: cfg.isLocalRunning ?? true,
          port: cfg.port ?? 4000,
        })
      } else {
        const activeUrl = getBaseUrl()
        set({
          serverUrl: activeUrl,
          isRemote: checkIsRemote(activeUrl),
        })
      }
      // Trigger a silent background test
      get().testConnection()
    } catch (err: any) {
      console.warn('[ServerConfigStore] init error:', err)
      get().testConnection()
    }
  },

  setServerUrl: (url: string) => {
    set({
      serverUrl: url,
      isRemote: checkIsRemote(url),
    })
  },

  setAutoStartLocal: (autoStartLocal: boolean) => {
    set({ autoStartLocal })
  },

  testConnection: async (targetUrl?: string) => {
    const url = (targetUrl || get().serverUrl).trim().replace(/\/+$/, '')
    set({ isTesting: true, healthStatus: 'checking', errorMessage: null })

    try {
      let result: { ok: boolean; status?: number; latencyMs: number; error?: string; serverInfo?: any }

      if (api.server?.testConnection) {
        result = await api.server.testConnection(url)
      } else {
        const startTime = performance.now()
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)
          const res = await fetch(`${url}/health`, { signal: controller.signal })
          clearTimeout(timeoutId)
          const latencyMs = Math.round(performance.now() - startTime)
          let info = null
          try { info = await res.json() } catch {}
          result = { ok: res.ok, status: res.status, latencyMs, serverInfo: info }
        } catch (e: any) {
          result = {
            ok: false,
            latencyMs: Math.round(performance.now() - startTime),
            error: e?.name === 'AbortError' ? 'Connection timed out (4s)' : (e?.message || 'Failed to reach server'),
          }
        }
      }

      set({
        isTesting: false,
        healthStatus: result.ok ? 'healthy' : 'unhealthy',
        latencyMs: result.latencyMs,
        lastChecked: new Date().toLocaleTimeString(),
        serverInfo: result.serverInfo || null,
        errorMessage: result.ok ? null : (result.error || `HTTP ${result.status}`),
      })

      return {
        ok: result.ok,
        latencyMs: result.latencyMs,
        error: result.error,
      }
    } catch (err: any) {
      set({
        isTesting: false,
        healthStatus: 'unhealthy',
        latencyMs: null,
        lastChecked: new Date().toLocaleTimeString(),
        errorMessage: err?.message || 'Connection failed',
      })
      return { ok: false, latencyMs: 0, error: err?.message }
    }
  },

  saveConfig: async (newUrl?: string, autoStart?: boolean) => {
    const url = (newUrl ?? get().serverUrl).trim().replace(/\/+$/, '')
    const autoStartLocal = autoStart ?? get().autoStartLocal

    // Validate URL syntax
    if (!/^https?:\/\/.+/i.test(url)) {
      return { success: false, error: 'Server URL must start with http:// or https://' }
    }

    set({ isSaving: true })

    try {
      // 1. Update frontend base URL & localStorage
      setBaseUrl(url)

      // 2. Persist via IPC if available
      if (api.server?.saveConfig) {
        await api.server.saveConfig({ serverUrl: url, autoStartLocal })
      }

      // 3. Persist via AppSettings if available
      try {
        if (api.settings?.save) {
          await api.settings.save({
            backend_server_url: url,
            backend_auto_start_local: autoStartLocal,
          })
        }
      } catch {}

      // 4. Reconnect WebSocket to new backend
      try {
        wsClient.reconnectTo(url)
      } catch {}

      set({
        serverUrl: url,
        autoStartLocal,
        isRemote: checkIsRemote(url),
        isSaving: false,
      })

      // 5. Test the newly configured URL
      await get().testConnection(url)

      return { success: true }
    } catch (err: any) {
      set({ isSaving: false })
      return { success: false, error: err?.message || 'Failed to save server configuration' }
    }
  },

  restartLocalServer: async () => {
    set({ isTesting: true })
    try {
      let res = { success: false, port: 4000 }
      if (api.server?.restartLocal) {
        res = await api.server.restartLocal()
      }
      await get().testConnection()
      set({ isTesting: false, isLocalRunning: res.success })
      return res
    } catch (err) {
      set({ isTesting: false })
      throw err
    }
  },
}))
