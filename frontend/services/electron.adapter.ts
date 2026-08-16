// src/services/electron.adapter.ts
// Electron adapter — delegates to window.api for IPC-based calls,
// and to the local Hono server for the pipelines namespace (which is
// server-side only and has no IPC handlers).

import type { IApiService } from './api.interface'
import { sharedServerAdapters } from './pipelines.adapter'

const windowApi = (window as any).api ?? {}

export const electronAdapter: IApiService = {
  ...windowApi,
  ...sharedServerAdapters,
  workers: {
    ...sharedServerAdapters.workers,
    getLocalStatus: () => (window as any).electron?.ipcRenderer?.invoke?.('worker:getStatus') ?? Promise.resolve({ connected: false }),
    saveLocalConfig: (config: any) => (window as any).electron?.ipcRenderer?.invoke?.('worker:saveConfig', config) ?? Promise.resolve({}),
    connectLocal: () => (window as any).electron?.ipcRenderer?.invoke?.('worker:connect') ?? Promise.resolve({}),
    disconnectLocal: () => (window as any).electron?.ipcRenderer?.invoke?.('worker:disconnect') ?? Promise.resolve({}),
  },
} as unknown as IApiService
