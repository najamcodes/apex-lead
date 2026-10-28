// src/services/pipelines.adapter.ts
// Shared server-backed implementation of the pipelines API namespace.
// Used by both the electron and web adapters since pipelines always
// run on the Katal server (not via IPC).

import { useAuthStore } from '../store/auth.store'

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = window.localStorage.getItem('backend_server_url')
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '')
    }
  }
  return (
    (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    'http://localhost:4000'
  )
}

export function setBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('backend_server_url', clean)
  }
  BASE = clean
}

export let BASE = getBaseUrl()

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Desktop-App': 'true',
  }
  try {
    const state = useAuthStore.getState()
    if (state?.userId) {
      headers['X-User-Id'] = String(state.userId)
    }
    if (state?.orgId) {
      headers['X-Org-Id'] = String(state.orgId)
    }
    if (state?.role) {
      headers['X-Current-Role'] = state.role
    }
  } catch {}
  return headers
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : (undefined as T)
}

export const pipelinesServerAdapter = {
  list: () => get('/api/pipelines'),
  get: (id: string) => get(`/api/pipelines/${id}`),
  create: (data: any) => post('/api/pipelines', data),
  update: (id: string, data: any) => put(`/api/pipelines/${id}`, data),
  delete: (id: string) => del(`/api/pipelines/${id}`),
  duplicate: (id: string) => post(`/api/pipelines/${id}/duplicate`, {}),
  run: (id: string, input: any, target?: string) => post(`/api/pipelines/${id}/run`, { input, target }),
  replay: (_pipelineId: string, runId: string, fromNodeId: string) => post(`/api/pipelines/runs/${runId}/replay`, { fromNodeId }),
  getRun: (runId: string) => get(`/api/pipelines/runs/${runId}`),
  listRuns: (pipelineId: string) => get(`/api/pipelines/${pipelineId}/runs`),
  cancelRun: (runId: string) => post(`/api/pipelines/runs/${runId}/cancel`, {}),
  nodeTypes: () => get('/api/pipelines/node-types'),
  collections: () => get('/api/pipelines/collections'),
  templates: () => get('/api/pipelines/templates'),
  instantiateTemplate: (templateId: string) => post(`/api/pipelines/templates/${templateId}/instantiate`, {}),
}

export const collectionsServerAdapter = {
  list: () => get('/api/collections'),
  get: (name: string, params?: any) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.search) qs.set('search', params.search)
    if (params?.sortBy) qs.set('sortBy', params.sortBy)
    if (params?.sortDir) qs.set('sortDir', params.sortDir)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return get(`/api/collections/${name}${query}`)
  },
  update: (name: string, id: string, body: any) => put(`/api/collections/${name}/${id}`, body),
  delete: (name: string, id: string) => del(`/api/collections/${name}/${id}`),
  export: (name: string, format: 'csv' | 'json' = 'csv') => post(`/api/collections/${name}/export`, { format }),
}

export const analyticsServerAdapter = {
  getRoi: () => get('/api/analytics/roi'),
}

export const approvalsServerAdapter = {
  list: (status: string = 'pending') => get(`/api/approvals?status=${encodeURIComponent(status)}`),
  get: (id: string) => get(`/api/approvals/${id}`),
  action: (id: string, action: 'approve' | 'reject', modifiedRecords?: any[], reviewerNotes?: string) =>
    post(`/api/approvals/${id}/action`, { action, modifiedRecords, reviewerNotes }),
}

export const aiConnectionsServerAdapter = {
  list: () => get('/api/ai-connections'),
  get: (id: string) => get(`/api/ai-connections/${id}`),
  create: (data: any) => post('/api/ai-connections', data),
  update: (id: string, data: any) => put(`/api/ai-connections/${id}`, data),
  delete: (id: string) => del(`/api/ai-connections/${id}`),
  setDefault: (id: string) => post(`/api/ai-connections/${id}/set-default`, {}),
  test: (id: string) => post(`/api/ai-connections/${id}/test`, {}),
}

export const customNodesServerAdapter = {
  list: () => get('/api/custom-nodes'),
  get: (id: string) => get(`/api/custom-nodes/${id}`),
  create: (data: any) => post('/api/custom-nodes', data),
  update: (id: string, data: any) => put(`/api/custom-nodes/${id}`, data),
  delete: (id: string) => del(`/api/custom-nodes/${id}`),
  test: (id: string, args: any) => post(`/api/custom-nodes/${id}/test`, args),
}

export const workersServerAdapter = {
  list: () => get('/api/workers'),
  generateToken: () => post('/api/workers/token', {}),
  delete: (id: string) => del(`/api/workers/${id}`),
  dispatch: (args: any) => post('/api/workers/dispatch', args),
}

export const serverServerAdapter = {
  getConfig: async () => {
    const winApi = typeof window !== 'undefined' ? (window as any).api?.server : undefined
    if (winApi && typeof winApi.getConfig === 'function') {
      return winApi.getConfig()
    }
    const currentUrl = getBaseUrl()
    const isRemote = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(currentUrl)
    return {
      serverUrl: currentUrl,
      autoStartLocal: true,
      isRemote,
      isLocalRunning: true,
      port: 4000,
    }
  },
  saveConfig: async (config: { serverUrl: string; autoStartLocal?: boolean }) => {
    setBaseUrl(config.serverUrl)
    const winApi = typeof window !== 'undefined' ? (window as any).api?.server : undefined
    if (winApi && typeof winApi.saveConfig === 'function') {
      return winApi.saveConfig(config)
    }
    return { success: true, serverUrl: getBaseUrl() }
  },
  testConnection: async (url?: string) => {
    const target = (url || getBaseUrl()).replace(/\/+$/, '')
    const startTime = performance.now()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${target}/health`, {
        signal: controller.signal,
        headers: getAuthHeaders(),
      })
      clearTimeout(timeoutId)
      const latencyMs = Math.round(performance.now() - startTime)
      let info: any = null
      try { info = await res.json() } catch {}
      return {
        ok: res.ok,
        status: res.status,
        latencyMs,
        serverInfo: info,
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime)
      return {
        ok: false,
        latencyMs,
        error: err?.name === 'AbortError' ? 'Connection timed out (4s)' : (err?.message || 'Connection failed'),
      }
    }
  },
  restartLocal: async () => {
    const winApi = typeof window !== 'undefined' ? (window as any).api?.server : undefined
    if (winApi && typeof winApi.restartLocal === 'function') {
      return winApi.restartLocal()
    }
    return { success: true, port: 4000 }
  },
}

export const sharedServerAdapters = {
  pipelines: pipelinesServerAdapter,
  collections: collectionsServerAdapter,
  analytics: analyticsServerAdapter,
  approvals: approvalsServerAdapter,
  aiConnections: aiConnectionsServerAdapter,
  customNodes: customNodesServerAdapter,
  workers: workersServerAdapter,
  server: serverServerAdapter,
}
