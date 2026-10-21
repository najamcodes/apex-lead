// electron/ipc/decision.ipc.ts
// Electron IPC handlers for OpenJev System-One Decision Engine, Model Catalog,
// Local HuggingFace Downloader, LAN Server configuration, and 4-Tier Decision Cascade.

import { ipcMain, BrowserWindow } from 'electron'
import {
  DECISION_MODEL_CATALOG,
  modelDownloadManager,
  systemOneEngine,
  decisionCascadeEngine,
} from '@sdk/core/decision'
import type { SystemOneQuestion, CascadePolicy } from '@sdk/core/decision'

export function registerDecisionIpcHandlers(win?: BrowserWindow): void {
  // 1. Get full catalog with installation and local status
  ipcMain.handle('decision:get-catalog', async () => {
    return DECISION_MODEL_CATALOG.map((m) => ({
      ...m,
      isInstalled: modelDownloadManager.isModelInstalled(m.id),
      localPath: modelDownloadManager.getModelFilePath(m.id) || undefined,
    }))
  })

  // 2. Get list of all installed models on disk
  ipcMain.handle('decision:get-installed', async () => {
    return modelDownloadManager.getInstalledModels()
  })

  // 3. Download a model from Hugging Face Hub
  ipcMain.handle('decision:download-model', async (event, modelId: string) => {
    try {
      const filePath = await modelDownloadManager.downloadModel(modelId, {
        onProgress: (progress) => {
          const target = event?.sender && !event.sender.isDestroyed() ? event.sender : (win && !win.isDestroyed() ? win.webContents : null)
          if (target) {
            target.send('decision:download-progress', progress)
          }
        },
      })
      return { success: true, filePath }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  // 4. Cancel an active download
  ipcMain.handle('decision:cancel-download', async (_event, modelId: string) => {
    const cancelled = modelDownloadManager.cancelDownload(modelId)
    return { success: cancelled }
  })

  // 5. Delete a model from local disk
  ipcMain.handle('decision:delete-model', async (_event, modelId: string) => {
    const deleted = modelDownloadManager.deleteModel(modelId)
    return { success: deleted }
  })

  // 6. Test inference on arbitrary state and questions
  ipcMain.handle('decision:test-inference', async (_event, params: {
    state: unknown
    questions: Record<string, SystemOneQuestion>
    mode?: any
    modelId?: string
    lanEndpoint?: string
    apiKey?: string
  }) => {
    try {
      const response = await systemOneEngine.execute(params.state, params.questions, {
        mode: params.mode,
        modelId: params.modelId,
        lanEndpoint: params.lanEndpoint,
        apiKey: params.apiKey,
      })
      return { success: true, response }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  // 7. Test 4-tier decision cascade
  ipcMain.handle('decision:test-cascade', async (_event, params: {
    state: Record<string, any>
    policy: CascadePolicy
  }) => {
    try {
      const response = await decisionCascadeEngine.evaluate(params.state, params.policy)
      const telemetry = decisionCascadeEngine.getTelemetry()
      return { success: true, response, telemetry }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  // 8. Get cascade telemetry
  ipcMain.handle('decision:get-telemetry', async () => {
    return decisionCascadeEngine.getTelemetry()
  })

  // 9. Reset cascade telemetry
  ipcMain.handle('decision:reset-telemetry', async () => {
    decisionCascadeEngine.resetTelemetry()
    return { success: true }
  })
}
