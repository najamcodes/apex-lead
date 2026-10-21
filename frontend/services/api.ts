// src/services/api.ts
// Runtime selector — picks the correct adapter based on build-time env var.
//
// Electron build: VITE_ADAPTER is unset or 'electron' → electronAdapter
// Web build:      VITE_ADAPTER is 'web'               → webAdapter
//
// Vite tree-shakes the unused adapter out of the bundle.

import type { IApiService } from './api.interface'
import { webAdapter } from './web.adapter'
import { electronAdapter } from './electron.adapter'

// Detect environment: if window.api exists we're in Electron,
// otherwise fall back to the web adapter.
const isWeb =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADAPTER === 'web') ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADAPTER === 'web') ||
  (typeof window !== 'undefined' && !(window as any).api)

export const api: IApiService = isWeb ? webAdapter : electronAdapter
