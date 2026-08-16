// src/services/web.adapter.ts
// Web adapter — delegates to the Hono REST API via fetch()
// and uses WebSocket for real-time events.

import type { IApiService } from './api.interface'
import { wsClient } from './ws-client'
import { sharedServerAdapters } from './pipelines.adapter'

// In Next.js use NEXT_PUBLIC_API_URL; in Vite use VITE_API_URL
const BASE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL)
  || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL)
  || 'http://localhost:4000'

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json()
}

async function del<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
    getAll: (filters) => get(`/api/leads${toQueryString(filters as any)}`),
    getById: (id) => get(`/api/leads/${id}`),
    insert: (data) => post('/api/leads', data),
    updateStatus: (id, status, notes) => patch(`/api/leads/${id}/status`, { status, notes }),
    delete: (id) => del(`/api/leads/${id}`)
  },

  stats: {
    getDashboard: () => get('/api/stats/dashboard'),
    getCityRoi: () => get('/api/stats/city-roi')
  },

  scraper: {
    start: (config) => post('/api/scraper/jobs', config),
    cancel: (jobId) => post(`/api/scraper/jobs/${jobId}/cancel`),
    pause: (jobId) => post(`/api/scraper/jobs/${jobId}/pause`),
    resume: (jobId) => post(`/api/scraper/jobs/${jobId}/resume`),
    delete: (jobId) => del(`/api/scraper/jobs/${jobId}`),
    deleteBatch: (jobIds) => del('/api/scraper/jobs', { ids: jobIds }),
    getJobs: (pagination) => get(`/api/scraper/jobs${toQueryString(pagination as any)}`),
    onProgress: (cb) => wsClient.subscribe('scraper:progress', cb)
  },

  ai: {
    scoreSite: (leadId, model) => post('/api/ai/score-site', { leadId, model }),
    draftEmail: (leadId, model) => post('/api/ai/draft-email', { leadId, model }),
    testConnection: (params) => post('/api/ai/test-connection', params || {})
  },

  settings: {
    get: () => get('/api/settings'),
    save: (patch_) => put('/api/settings', patch_)
  },

  analysis: {
    runLead: (leadId) => post(`/api/analysis/lead/${leadId}`),
    runBatch: (leadIds) => post('/api/analysis/batch', { leadIds }),
    onProgress: (cb) => wsClient.subscribe('analysis:progress', cb)
  },

  outreach: {
    send: (recordId) => post(`/api/outreach/${recordId}/send`),
    sendBatch: () => post('/api/outreach/send-batch'),
    getAll: (status, pagination) => get(`/api/outreach${toQueryString({ status, ...pagination })}`),
    markReplied: (outreachId) => patch(`/api/outreach/${outreachId}/replied`),
    markBounced: (outreachId) => patch(`/api/outreach/${outreachId}/bounced`),
    getPendingQueue: () => get('/api/outreach/pending-queue'),
    scheduleSeq: (input, businessName) => post('/api/outreach/schedule-sequence', { input, businessName }),
    getSequences: (pagination) => get(`/api/outreach/sequences${toQueryString(pagination as any)}`),
    exportCsv: () => get('/api/outreach/export-csv'),
    getChartData: () => get('/api/stats/chart-data'),
    smtp: {
      verify: () => get('/api/smtp/verify'),
      reinit: () => post('/api/smtp/reinit')
    }
  },

  bulk: {
    analyze: (leadIds) => post('/api/bulk/analyze', { leadIds }),
    score: (leadIds) => post('/api/bulk/score', { leadIds }),
    approve: (leadIds) => post('/api/bulk/approve', { leadIds }),
    scheduleSequences: (leadIds, templateId) => post('/api/bulk/schedule-sequences', { leadIds, templateId })
  },

  notes: {
    get: (leadId) => get(`/api/leads/${leadId}/notes`),
    save: (leadId, body) => put(`/api/leads/${leadId}/notes`, { body })
  },

  activity: {
    get: (leadId) => get(`/api/leads/${leadId}/activity`),
    getRecent: () => get('/api/activity/recent')
  },

  scheduler: {
    status: () => get('/api/scheduler/status')
  },

  emailFinder: {
    run: (leadId) => post(`/api/email-finder/lead/${leadId}`),
    runBatch: (leadIds) => post('/api/email-finder/batch', { leadIds }),
    onProgress: (cb) => wsClient.subscribe('emailFinder:progress', cb)
  },

  emailVerifier: {
    runBatch: (leadIds) => post('/api/email-verifier/batch', { leadIds }),
    onProgress: (cb) => wsClient.subscribe('emailVerifier:progress', cb)
  },

  templates: {
    getAll: () => get('/api/templates'),
    create: (data) => post('/api/templates', data),
    update: (id, data) => put(`/api/templates/${id}`, data),
    delete: (id) => del(`/api/templates/${id}`)
  },

  emailAccounts: {
    getAll: () => get('/api/email-accounts'),
    add: (data) => post('/api/email-accounts', data),
    update: (id, data) => put(`/api/email-accounts/${id}`, data),
    delete: (id) => del(`/api/email-accounts/${id}`),
    test: (id) => post(`/api/email-accounts/${id}/test`)
  },

  auth: {
    login: (args) => post('/api/auth/login', args),
    register: (args) => post('/api/auth/register', args),
    restoreSession: (args) => post('/api/auth/restore-session', args)
  },

  users: {
    list: () => get('/api/users'),
    add: (args) => post('/api/users', args),
    updatePermissions: (userId, permissions) => put(`/api/users/${userId}/permissions`, { permissions }),
    updateRole: (userId, role) => put(`/api/users/${userId}/role`, { role }),
    delete: (userId) => del(`/api/users/${userId}`)
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
