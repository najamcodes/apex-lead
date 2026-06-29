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
  run: (id: string, input: any) => post(`/api/pipelines/${id}/run`, input),
  getRun: (runId: string) => get(`/api/pipelines/runs/${runId}`),
  listRuns: (pipelineId: string) => get(`/api/pipelines/${pipelineId}/runs`),
  cancelRun: (runId: string) => post(`/api/pipelines/runs/${runId}/cancel`, {}),
  nodeTypes: () => get('/api/pipelines/node-types'),
  collections: () => get('/api/pipelines/collections'),
}
