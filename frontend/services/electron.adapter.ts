// src/services/electron.adapter.ts
// Electron adapter — delegates to window.api for IPC-based calls,
// and to the local Hono server for the pipelines namespace (which is
// server-side only and has no IPC handlers).

import type { IApiService } from './api.interface'
import { pipelinesServerAdapter } from './pipelines.adapter'

const windowApi = (window as any).api ?? {}

export const electronAdapter: IApiService = {
  ...windowApi,
  pipelines: pipelinesServerAdapter,
} as unknown as IApiService
