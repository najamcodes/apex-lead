// electron/ipc/settings.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { getSettings, saveSettings } from '../../src/db/queries/settings.queries'

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
  ipcMain.handle(IPC.SETTINGS_SAVE, (_event, patch: unknown) => saveSettings(patch as any))
}
