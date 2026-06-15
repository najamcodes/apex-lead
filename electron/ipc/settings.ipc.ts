// electron/ipc/settings.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { getSettings, saveSettings } from '../../src/db/queries/settings.queries'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../src/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}
import { initSmtp } from '../outreach'
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
