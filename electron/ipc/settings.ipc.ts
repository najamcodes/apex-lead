// electron/ipc/settings.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '@sdk/core/types'
import { getSettings, saveSettings } from '../db/queries/settings.queries'
import { requirePermission } from '../db/queries/tenant'
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
