// electron/ipc/settings.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { getSettings, saveSettings } from '../../backend/db/queries/settings.queries'
import { requirePermission } from '../../backend/db/queries/tenant'
import { initSmtp } from '@sdk/core/outreach'
import { initScheduler } from '../scheduler'
import { BrowserWindow } from 'electron'

export function registerSettingsIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings(true))
  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, payload: Record<string, string>) => {
    requirePermission('manage_settings')
    await saveSettings(payload)
    await initSmtp()
    await initScheduler(win)
    return { success: true }
  })
}
