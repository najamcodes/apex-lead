// electron/ipc/analysis.ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { analyzeLead, analyzeBatch } from '../../backend/core/analysis'

export function registerAnalysisIpcHandlers(win: BrowserWindow): void {
  // Analyze a single lead
  ipcMain.handle(IPC.ANALYSIS_RUN_LEAD, async (_event, leadId: number) => {
    return analyzeLead(leadId)
  })

  // Analyze all 'scraped' leads in batch with progress events
  ipcMain.handle(IPC.ANALYSIS_RUN_BATCH, async (_event, leadIds: number[]) => {
    await analyzeBatch(leadIds, (done, total, leadId) => {
      win.webContents.send(IPC.ANALYSIS_PROGRESS, { done, total, leadId })
    })
  })
}
