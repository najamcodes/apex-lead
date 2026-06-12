// extension/shared/api.ts
// Client for the LeadHunter local HTTP server.

const BASE = 'http://127.0.0.1:39521'
const TIMEOUT_MS = 4000

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function checkAppStatus(): Promise<import('./types').AppStatus | null> {
  try {
    const res = await safeFetch(`${BASE}/status`)
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

export async function addLead(
  payload: import('./types').LeadPayload
): Promise<import('./types').ApiResponse> {
  try {
    const res = await safeFetch(`${BASE}/leads`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    return res.json()
  } catch (err) {
    return { ok: false, error: 'LeadHunter app is not running. Open the desktop app first.' }
  }
}

export async function getRecentLeads(): Promise<any[]> {
  try {
    const res = await safeFetch(`${BASE}/leads`)
    const data = await res.json()
    return data.leads ?? []
  } catch {
    return []
  }
}
