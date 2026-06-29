// src/services/api.ts
// Runtime selector — picks the correct adapter based on build-time env var.
//
// Electron build: VITE_ADAPTER is unset or 'electron' → electronAdapter
// Web build:      VITE_ADAPTER is 'web'               → webAdapter
//
// Vite tree-shakes the unused adapter out of the bundle.

import type { IApiService } from './api.interface'

let _api: IApiService

// Detect environment: if window.api exists we're in Electron,
// otherwise fall back to the web adapter.
// The VITE_ADAPTER env var is the primary signal (set at build time),
// but we also auto-detect at runtime for safety.
const isWeb =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADAPTER === 'web') ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADAPTER === 'web') ||
  (typeof window !== 'undefined' && !(window as any).api)

if (isWeb) {
  // Dynamic import avoids bundling the web adapter in Electron builds
  const { webAdapter } = require('./web.adapter')
  _api = webAdapter
} else {
  const { electronAdapter } = require('./electron.adapter')
  _api = electronAdapter
}

export const api: IApiService = _api
