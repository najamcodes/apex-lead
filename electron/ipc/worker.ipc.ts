// electron/ipc/worker.ipc.ts
// IPC handlers for configuring and monitoring Farm Worker Mode in the desktop app.

import { ipcMain } from 'electron'
import { workerAgent, type WorkerAgentConfig } from '../worker/worker-agent'

export function registerWorkerIpc(): void {
  ipcMain.handle('worker:getStatus', async () => {
    return workerAgent.getStatus()
  })

  ipcMain.handle('worker:saveConfig', async (_, config: Partial<WorkerAgentConfig>) => {
    return await workerAgent.saveConfig(config)
  })

  ipcMain.handle('worker:connect', async () => {
    workerAgent.connect()
    return workerAgent.getStatus()
  })

  ipcMain.handle('worker:disconnect', async () => {
    workerAgent.disconnect()
    return workerAgent.getStatus()
  })
}
