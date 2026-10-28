import { ipcMain } from 'electron'
import { IPC } from '@sdk/core/types'
import {
  getAllSuppressions,
  addSuppression,
  batchAddSuppressions,
  removeSuppression,
  isSuppressed,
} from '../db/queries/suppression.queries'
import { requirePermission } from '../db/queries/tenant'

export function registerSuppressionIpcHandlers(): void {
  ipcMain.handle(IPC.SUPPRESSION_GET_ALL, async (_event, pagination?: { page?: number; pageSize?: number; search?: string }) => {
    return await getAllSuppressions(undefined, pagination)
  })

  ipcMain.handle(IPC.SUPPRESSION_ADD, async (_event, payload: { value: string; type?: any; reason?: any }) => {
    requirePermission('manage_settings')
    return await addSuppression(payload)
  })

  ipcMain.handle(IPC.SUPPRESSION_BATCH_ADD, async (_event, values: string[], type?: any, reason?: any) => {
    requirePermission('manage_settings')
    return await batchAddSuppressions(values, type, reason)
  })

  ipcMain.handle(IPC.SUPPRESSION_REMOVE, async (_event, id: number) => {
    requirePermission('manage_settings')
    return await removeSuppression(id)
  })

  ipcMain.handle(IPC.SUPPRESSION_CHECK, async (_event, query: string) => {
    return await isSuppressed(query)
  })
}
