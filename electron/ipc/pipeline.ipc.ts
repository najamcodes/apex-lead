// electron/ipc/pipeline.ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import {
  runNightlyPipeline,
  getPipelineStatus,
} from '../pipeline'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../backend/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}

import {
  startNightlyRunner,
  stopNightlyRunner,
  restartNightlyRunner,
  sendMorningDigest,
  getNightlyRunnerStatus,
} from '../pipeline/nightly-runner'
import {
  getAllTargets,
  insertTarget,
  updateTarget,
  toggleTarget,
  deleteTarget,
} from '../../backend/db/queries/targets.queries'
import { getAllDigests } from '../../backend/db/queries/digests.queries'

export function registerPipelineIpcHandlers(win: BrowserWindow): void {
  // Targets CRUD
  ipcMain.handle(IPC.TARGETS_GET_ALL, () => getAllTargets())
  ipcMain.handle(IPC.TARGETS_INSERT, async (_, data) => {
    requirePermission('manage_settings')
    return insertTarget(data)
  })
  ipcMain.handle(IPC.TARGETS_UPDATE, async (_, id, patch) => {
    requirePermission('manage_settings')
    return updateTarget(id, patch)
  })
  ipcMain.handle(IPC.TARGETS_DELETE, async (_, id) => {
    requirePermission('manage_settings')
    return deleteTarget(id)
  })
  ipcMain.handle(IPC.TARGETS_TOGGLE, async (_, id) => {
    requirePermission('manage_settings')
    return toggleTarget(id)
  })

  // Run pipeline now (manual trigger)
  ipcMain.handle(IPC.PIPELINE_RUN_NOW, async () => {
    requirePermission('run_scraper')
    const result = await runNightlyPipeline((msg) => {
      win.webContents.send('pipeline:log', msg)
    })
    await sendMorningDigest(result)
    return result
  })

  // Pipeline status
  ipcMain.handle(IPC.PIPELINE_GET_STATUS, async () => ({
    ...getPipelineStatus(),
    runner: await getNightlyRunnerStatus(),
  }))

  // Digest history
  ipcMain.handle(IPC.DIGESTS_GET_ALL, () => getAllDigests())

  // Scheduler controls
  ipcMain.handle('pipeline:startRunner',   () => startNightlyRunner())
  ipcMain.handle('pipeline:stopRunner',    () => stopNightlyRunner())
  ipcMain.handle('pipeline:restartRunner', () => restartNightlyRunner())
  ipcMain.handle('pipeline:sendDigestNow', async () => sendMorningDigest())
}
