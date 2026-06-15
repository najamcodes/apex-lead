import { ipcMain } from 'electron'
import {
  getAllQueryProfiles,
  getActiveQueryProfiles,
  insertQueryProfile,
  updateQueryProfileStatus,
  deleteQueryProfile
} from '../../src/db/queries/query-profiles.queries'
import type { QueryProfileInsert } from '../../src/types/pipeline.types'

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
    return await insertQueryProfile(data)
  })

  ipcMain.handle(IPC.QUERY_PROFILES.UPDATE_STATUS, async (_, id: number, status: 'active' | 'paused' | 'error') => {
    await updateQueryProfileStatus(id, status)
    return true
  })

  ipcMain.handle(IPC.QUERY_PROFILES.DELETE, async (_, id: number) => {
    await deleteQueryProfile(id)
    return true
  })
}
