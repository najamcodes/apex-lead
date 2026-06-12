// electron/ipc/settings.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { getSettings, saveSettings } from '../../src/db/queries/settings.queries'
import { initSmtp } from '../outreach'

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, patch: unknown) => {
    await saveSettings(patch as any)
    await initSmtp()
  })
}
