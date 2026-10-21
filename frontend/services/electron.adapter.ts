// src/services/electron.adapter.ts
// Electron adapter — delegates to window.api for IPC-based calls,
// and to the local Hono server for the pipelines namespace (which is
// server-side only and has no IPC handlers).

import type { IApiService } from './api.interface'
import { sharedServerAdapters } from './pipelines.adapter'

export const electronAdapter: IApiService = new Proxy({} as IApiService, {
  get(_target, prop: string) {
    if (prop === 'workers') {
      return {
        ...sharedServerAdapters.workers,
        getLocalStatus: () => (window as any).api?.workers?.getStatus?.() ?? Promise.resolve({ connected: false }),
        saveLocalConfig: (config: any) => (window as any).api?.workers?.saveConfig?.(config) ?? Promise.resolve({}),
        connectLocal: () => (window as any).api?.workers?.connect?.() ?? Promise.resolve({}),
        disconnectLocal: () => (window as any).api?.workers?.disconnect?.() ?? Promise.resolve({}),
      }
    }
    if (prop in sharedServerAdapters) {
      return (sharedServerAdapters as any)[prop]
    }
    const winApi = (window as any).api
    if (winApi && prop in winApi) {
      return winApi[prop]
    }
    return undefined
  }
})
