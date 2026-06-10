// electron/ipc/index.ts
import { BrowserWindow } from 'electron'
import { registerLeadIpcHandlers } from './leads.ipc'
import { registerScraperIpcHandlers } from './scraper.ipc'
import { registerAiIpcHandlers } from './ai.ipc'
import { registerSettingsIpcHandlers } from './settings.ipc'
import { registerAnalysisIpcHandlers } from './analysis.ipc'
import { registerOutreachIpcHandlers } from './outreach.ipc'
import { registerBulkIpcHandlers } from './bulk.ipc'

export function registerAllIpcHandlers(win: BrowserWindow): void {
  registerLeadIpcHandlers()
  registerScraperIpcHandlers(win)
  registerAiIpcHandlers()
  registerSettingsIpcHandlers()
  registerAnalysisIpcHandlers(win)
  registerOutreachIpcHandlers()
  registerBulkIpcHandlers()
}
