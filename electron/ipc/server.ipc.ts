// electron/ipc/server.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { serverManager } from '../server-manager'
import { workerAgent } from '../worker/worker-agent'
import { getSettings, saveSettings } from '../../backend/db/queries/settings.queries'

export function registerServerIpcHandlers(): void {
  // Get current server configuration
  ipcMain.handle(IPC.SERVER_GET_CONFIG, async () => {
    const settings = await getSettings()
    const serverUrl = settings.backend_server_url || serverManager.getServerUrl()
    const autoStartLocal = settings.backend_auto_start_local ?? serverManager.isAutoStartEnabled()
    const isLocalRunning = await serverManager.isServerRunning()
    const isRemote = serverManager.isRemote()

    return {
      serverUrl,
      autoStartLocal,
      isRemote,
      isLocalRunning,
      port: serverManager.getPort(),
    }
  })

  // Save new server configuration
  ipcMain.handle(IPC.SERVER_SAVE_CONFIG, async (_event, config: { serverUrl: string; autoStartLocal?: boolean }) => {
    const serverUrl = config.serverUrl.trim().replace(/\/+$/, '')
    const autoStartLocal = config.autoStartLocal ?? true

    await saveSettings({
      backend_server_url: serverUrl,
      backend_auto_start_local: autoStartLocal as any,
    })

    serverManager.configure(serverUrl, autoStartLocal)

    // Sync worker agent with new server URL
    try {
      await workerAgent.saveConfig({ serverUrl })
    } catch (err) {
      console.warn('[ServerIPC] Could not sync workerAgent config:', err)
    }

    return { success: true, serverUrl }
  })

  // Test connection to a given URL or current URL
  ipcMain.handle(IPC.SERVER_TEST_URL, async (_event, url?: string) => {
    return serverManager.testUrl(url)
  })

  // Restart local server process
  ipcMain.handle(IPC.SERVER_RESTART_LOCAL, async () => {
    return serverManager.restart()
  })
}
