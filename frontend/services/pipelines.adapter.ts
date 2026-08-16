// src/services/pipelines.adapter.ts
// Shared server-backed implementation of the pipelines API namespace.
// Used by both the electron and web adapters since pipelines always
// run on the Hono server (not via IPC).

const BASE =
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'http://localhost:4000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' })
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

export const sharedServerAdapters = {
  pipelines: pipelinesServerAdapter,
  collections: collectionsServerAdapter,
  analytics: analyticsServerAdapter,
  approvals: approvalsServerAdapter,
  aiConnections: aiConnectionsServerAdapter,
  customNodes: customNodesServerAdapter,
  workers: workersServerAdapter,
}
