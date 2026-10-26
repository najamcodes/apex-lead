// src/services/web.adapter.ts
// Web adapter — delegates to the Hono REST API via fetch()
// and uses WebSocket for real-time events.

import type { IApiService } from './api.interface'
import { wsClient } from './ws-client'
import { sharedServerAdapters, getBaseUrl, getAuthHeaders } from './pipelines.adapter'

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
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
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
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
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

async function del<T = void>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  // Some DELETE endpoints may not return JSON
  const text = await res.text()
  const trimmed = text.trim()
  return trimmed ? JSON.parse(trimmed) : undefined as T
}

function toQueryString(params?: Record<string, any>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString()
}

// ─── Adapter implementation ─────────────────────────────────────────────────

export const webAdapter: IApiService = {
  leads: {
    getAll: (filters?: any) => get(`/api/leads${toQueryString(filters as any)}`),
    getById: (id: any) => get(`/api/leads/${id}`),
    insert: (data: any) => post('/api/leads', data),
    updateStatus: (id: any, status: any, notes?: any) => patch(`/api/leads/${id}/status`, { status, notes }),
    delete: (id: any) => del(`/api/leads/${id}`)
  },

  stats: {
    getDashboard: () => get('/api/stats/dashboard'),
    getCityRoi: () => get('/api/stats/city-roi')
  },

  scraper: {
    start: (config: any) => post('/api/scraper/jobs', config),
    cancel: (jobId: any) => post(`/api/scraper/jobs/${jobId}/cancel`),
    pause: (jobId: any) => post(`/api/scraper/jobs/${jobId}/pause`),
    resume: (jobId: any) => post(`/api/scraper/jobs/${jobId}/resume`),
    delete: (jobId: any) => del(`/api/scraper/jobs/${jobId}`),
    deleteBatch: (jobIds: any) => del('/api/scraper/jobs', { ids: jobIds }),
    getJobs: (pagination?: any) => get(`/api/scraper/jobs${toQueryString(pagination as any)}`),
    onProgress: (cb: any) => wsClient.subscribe('scraper:progress', cb)
  },

  ai: {
    scoreSite: (leadId: any, model?: any) => post('/api/ai/score-site', { leadId, model }),
    draftEmail: (leadId: any, model?: any) => post('/api/ai/draft-email', { leadId, model }),
    testConnection: (params?: any) => post('/api/ai/test-connection', params || {})
  },

  settings: {
    get: () => get('/api/settings'),
    save: (patch_: any) => put('/api/settings', patch_)
  },

  analysis: {
    runLead: (leadId: any) => post(`/api/analysis/lead/${leadId}`),
    runBatch: (leadIds: any) => post('/api/analysis/batch', { leadIds }),
    onProgress: (cb: any) => wsClient.subscribe('analysis:progress', cb)
  },

  outreach: {
    send: (recordId: any) => post(`/api/outreach/${recordId}/send`),
    sendBatch: () => post('/api/outreach/send-batch'),
    getAll: (status?: any, pagination?: any) => get(`/api/outreach${toQueryString({ status, ...pagination })}`),
    markReplied: (outreachId: any) => patch(`/api/outreach/${outreachId}/replied`),
    markBounced: (outreachId: any) => patch(`/api/outreach/${outreachId}/bounced`),
    getPendingQueue: () => get('/api/outreach/pending-queue'),
    scheduleSeq: (input: any, businessName: any) => post('/api/outreach/schedule-sequence', { input, businessName }),
    getSequences: (pagination?: any) => get(`/api/outreach/sequences${toQueryString(pagination as any)}`),
    exportCsv: () => get('/api/outreach/export-csv'),
    getChartData: () => get('/api/stats/chart-data'),
    smtp: {
      verify: () => get('/api/smtp/verify'),
      reinit: () => post('/api/smtp/reinit')
    }
  },

  bulk: {
    analyze: (leadIds: any) => post('/api/bulk/analyze', { leadIds }),
    score: (leadIds: any) => post('/api/bulk/score', { leadIds }),
    approve: (leadIds: any) => post('/api/bulk/approve', { leadIds }),
    scheduleSequences: (leadIds: any, templateId?: any) => post('/api/bulk/schedule-sequences', { leadIds, templateId })
  },

  notes: {
    get: (leadId: any) => get(`/api/leads/${leadId}/notes`),
    save: (leadId: any, body: any) => put(`/api/leads/${leadId}/notes`, { body })
  },

  activity: {
    get: (leadId: any) => get(`/api/leads/${leadId}/activity`),
    getRecent: () => get('/api/activity/recent')
  },

  scheduler: {
    status: () => get('/api/scheduler/status')
  },

  emailFinder: {
    run: (leadId: any) => post(`/api/email-finder/lead/${leadId}`),
    runBatch: (leadIds: any) => post('/api/email-finder/batch', { leadIds }),
    onProgress: (cb: any) => wsClient.subscribe('emailFinder:progress', cb)
  },

  emailVerifier: {
    runBatch: (leadIds: any) => post('/api/email-verifier/batch', { leadIds }),
    onProgress: (cb: any) => wsClient.subscribe('emailVerifier:progress', cb)
  },

  templates: {
    getAll: () => get('/api/templates'),
    create: (data: any) => post('/api/templates', data),
    update: (id: any, data: any) => put(`/api/templates/${id}`, data),
    delete: (id: any) => del(`/api/templates/${id}`)
  },

  emailAccounts: {
    getAll: () => get('/api/email-accounts'),
    add: (data: any) => post('/api/email-accounts', data),
    update: (id: any, data: any) => put(`/api/email-accounts/${id}`, data),
    delete: (id: any) => del(`/api/email-accounts/${id}`),
    test: (id: any) => post(`/api/email-accounts/${id}/test`)
  },

  auth: {
    login: (args: any) => post('/api/auth/login', args),
    register: (args: any) => post('/api/auth/register', args),
    restoreSession: (args: any) => post('/api/auth/restore-session', args)
  },

  users: {
    list: () => get('/api/users'),
    add: (args: any) => post('/api/users', args),
    updatePermissions: (userId: any, permissions: any) => put(`/api/users/${userId}/permissions`, { permissions }),
    updateRole: (userId: any, role: any) => put(`/api/users/${userId}/role`, { role }),
    delete: (userId: any) => del(`/api/users/${userId}`)
  },
  ...sharedServerAdapters,
  workers: {
    ...sharedServerAdapters.workers,
    getLocalStatus: async () => ({ connected: false, enabled: false, message: 'Web environment' }),
    saveLocalConfig: async () => ({}),
    connectLocal: async () => ({}),
    disconnectLocal: async () => ({}),
  } as any
} as unknown as IApiService
