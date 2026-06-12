// extension/popup/popup.tsx
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ExtractedPageData, AppStatus, ApiResponse } from '../shared/types'

type View = 'main' | 'recent'

interface RecentEntry {
  business_name: string
  website_url:   string
  result:        ApiResponse
  ts:            number
}

function StatusBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
      <span className="text-xs text-zinc-400">Connecting…</span>
    </div>
  )
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
        {connected ? 'LeadHunter connected' : 'App not running'}
      </span>
    </div>
  )
}

function Popup() {
  const [view, setView]             = useState<View>('main')
  const [status, setStatus]         = useState<AppStatus | null | undefined>(undefined)
  const [pageData, setPageData]     = useState<ExtractedPageData | null>(null)
  const [overrides, setOverrides]   = useState({ name: '', city: '', category: '' })
  const [sending, setSending]       = useState(false)
  const [result, setResult]         = useState<ApiResponse | null>(null)
  const [recent, setRecent]         = useState<RecentEntry[]>([])

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'APP_STATUS' }, (res) => {
      setStatus(res?.status ?? null)
    })

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' }, (res) => {
        if (res?.data) {
          setPageData(res.data)
          setOverrides({
            name:     res.data.business_name ?? '',
            city:     res.data.city          ?? '',
            category: res.data.category      ?? '',
          })
        }
      })
    })

    chrome.storage.local.get(['recentAdded'], (data) => {
      setRecent(Array.isArray(data.recentAdded) ? data.recentAdded : [])
    })
  }, [])

  const handleAdd = async () => {
    if (!pageData) return
    setSending(true)
    setResult(null)

    const payload = {
      business_name: overrides.name     || pageData.business_name,
      website_url:   pageData.website_url,
      phone:         pageData.phone     ?? undefined,
      email:         pageData.email     ?? undefined,
      city:          overrides.city     || pageData.city     || undefined,
      category:      overrides.category || pageData.category || undefined,
    }

    chrome.runtime.sendMessage({ type: 'ADD_LEAD', payload }, (res) => {
      setResult(res?.result ?? { ok: false, error: 'No response from background' })
      setSending(false)

      if (res?.result?.ok) {
        chrome.storage.local.get(['recentAdded'], (data) => {
          const list: RecentEntry[] = Array.isArray(data.recentAdded) ? data.recentAdded : []
          list.unshift({ ...payload, result: res.result, ts: Date.now() })
          chrome.storage.local.set({ recentAdded: list.slice(0, 10) })
          setRecent(list)
        })
      }
    })
  }

  const connected = status === undefined ? null : status !== null

  return (
    <div className="w-[340px] bg-zinc-900 text-zinc-100 font-sans">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-semibold text-zinc-100">LeadHunter</span>
        </div>
        <StatusBadge connected={connected} />
      </div>

      <div className="flex border-b border-zinc-800">
        {(['main', 'recent'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              view === v
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {v === 'recent' ? `Recent (${recent.length})` : 'Add lead'}
          </button>
        ))}
      </div>

      {view === 'main' && (
        <div className="p-4 space-y-3">
          {connected === false && (
            <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-400">
              Open the LeadHunter desktop app to add leads.
            </div>
          )}

          {pageData && (
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Business name</label>
                <input
                  type="text"
                  value={overrides.name}
                  onChange={(e) => setOverrides((o) => ({ ...o, name: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-md text-sm bg-zinc-800 border border-zinc-700
                    text-zinc-100 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-1">Website</label>
                <p className="text-xs text-zinc-400 truncate bg-zinc-800 px-2.5 py-1.5 rounded-md border border-zinc-700">
                  {pageData.website_url}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">City</label>
                  <input
                    type="text"
                    value={overrides.city}
                    onChange={(e) => setOverrides((o) => ({ ...o, city: e.target.value }))}
                    placeholder="e.g. Lahore"
                    className="w-full px-2.5 py-1.5 rounded-md text-sm bg-zinc-800 border border-zinc-700
                      text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Category</label>
                  <input
                    type="text"
                    value={overrides.category}
                    onChange={(e) => setOverrides((o) => ({ ...o, category: e.target.value }))}
                    placeholder="e.g. Restaurant"
                    className="w-full px-2.5 py-1.5 rounded-md text-sm bg-zinc-800 border border-zinc-700
                      text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 text-xs text-zinc-500">
                {pageData.phone && (
                  <span>📞 {pageData.phone}</span>
                )}
                {pageData.email && (
                  <span>✉ {pageData.email}</span>
                )}
                {!pageData.phone && !pageData.email && (
                  <span className="italic">No contact info found on page</span>
                )}
              </div>
            </div>
          )}

          {!pageData && (
            <p className="text-xs text-zinc-500 text-center py-4">
              Loading page data…
            </p>
          )}

          {result && (
            <div className={`rounded-lg px-3 py-2 text-xs ${
              result.ok
                ? result.duplicate
                  ? 'bg-amber-950/50 border border-amber-800/50 text-amber-400'
                  : 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-400'
                : 'bg-red-950/50 border border-red-800/50 text-red-400'
            }`}>
              {result.ok
                ? result.duplicate
                  ? '⚠ Already in your leads list'
                  : '✓ Lead added to LeadHunter!'
                : `✗ ${result.error}`}
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={sending || !pageData || !connected}
            className="w-full py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500
              disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {sending ? 'Adding…' : '+ Add to LeadHunter'}
          </button>
        </div>
      )}

      {view === 'recent' && (
        <div className="divide-y divide-zinc-800">
          {recent.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              No leads added yet this session.
            </p>
          ) : (
            recent.map((entry, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{entry.business_name}</p>
                    <p className="text-xs text-zinc-500 truncate">{entry.website_url}</p>
                  </div>
                  <span className={`text-xs flex-shrink-0 mt-0.5 ${
                    entry.result.ok
                      ? entry.result.duplicate ? 'text-amber-400' : 'text-emerald-400'
                      : 'text-red-400'
                  }`}>
                    {entry.result.ok
                      ? entry.result.duplicate ? 'Duplicate' : 'Added'
                      : 'Failed'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-zinc-800 text-center">
        <p className="text-xs text-zinc-600">
          Right-click any page → "Add to LeadHunter"
        </p>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Popup />)
