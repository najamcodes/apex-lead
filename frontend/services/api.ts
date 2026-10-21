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

export const api: IApiService = new Proxy({} as IApiService, {
  get(_target, prop: string) {
    const isWeb =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADAPTER === 'web') ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADAPTER === 'web') ||
      (typeof window !== 'undefined' && !(window as any).api)

    const activeAdapter = isWeb ? webAdapter : electronAdapter
    return (activeAdapter as any)[prop]
  }
})
