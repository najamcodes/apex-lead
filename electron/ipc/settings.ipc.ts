// electron/ipc/settings.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { getSettings, saveSettings } from '../../src/db/queries/settings.queries'
import { initSmtp } from '../outreach'
import { initScheduler } from '../scheduler'
import { BrowserWindow } from 'electron'

export function registerSettingsIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, patch: unknown) => {
    await saveSettings(patch as any)
    await initSmtp()
    await initScheduler(win)
  })
}
