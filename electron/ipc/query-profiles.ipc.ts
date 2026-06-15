import { ipcMain } from 'electron'
import {
  getAllQueryProfiles,
  getActiveQueryProfiles,
  insertQueryProfile,
  updateQueryProfileStatus,
  deleteQueryProfile
} from '../../src/db/queries/query-profiles.queries'
import type { QueryProfileInsert } from '../../src/types/pipeline.types'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../src/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}

export const IPC = {
  QUERY_PROFILES: {
    GET_ALL: 'query-profiles:get-all',
    GET_ACTIVE: 'query-profiles:get-active',
    INSERT: 'query-profiles:insert',
    UPDATE_STATUS: 'query-profiles:update-status',
    DELETE: 'query-profiles:delete',
  }
}

export function registerQueryProfilesIpc() {
  ipcMain.handle(IPC.QUERY_PROFILES.GET_ALL, async () => {
    return await getAllQueryProfiles()
  })

  ipcMain.handle(IPC.QUERY_PROFILES.GET_ACTIVE, async () => {
    return await getActiveQueryProfiles()
  })

  ipcMain.handle(IPC.QUERY_PROFILES.INSERT, async (_, data: QueryProfileInsert) => {
    requirePermission('manage_settings')
    return await insertQueryProfile(data)
  })

  ipcMain.handle(IPC.QUERY_PROFILES.UPDATE_STATUS, async (_, id: number, status: 'active' | 'paused' | 'error') => {
    requirePermission('manage_settings')
    await updateQueryProfileStatus(id, status)
    return true
  })

  ipcMain.handle(IPC.QUERY_PROFILES.DELETE, async (_, id: number) => {
    requirePermission('manage_settings')
    await deleteQueryProfile(id)
    return true
  })
}
