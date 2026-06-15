// electron/ipc/index.ts
import { BrowserWindow } from 'electron'
import { registerLeadIpcHandlers } from './leads.ipc'
import { registerScraperIpcHandlers } from './scraper.ipc'
import { registerAiIpcHandlers } from './ai.ipc'
import { registerSettingsIpcHandlers } from './settings.ipc'
import { registerAnalysisIpcHandlers } from './analysis.ipc'
import { registerOutreachIpcHandlers } from './outreach.ipc'
import { registerBulkIpcHandlers } from './bulk.ipc'
import { registerTemplatesIpc } from './templates.ipc'
import { registerPipelineIpcHandlers } from './pipeline.ipc'
import { registerQueryProfilesIpc } from './query-profiles.ipc'
import { registerEmailAccountsIpc } from './email-accounts.ipc'

export function registerAllIpcHandlers(win: BrowserWindow): void {
  registerLeadIpcHandlers()
  registerScraperIpcHandlers(win)
  registerAiIpcHandlers()
  registerSettingsIpcHandlers(win)
  registerAnalysisIpcHandlers(win)
  registerOutreachIpcHandlers()
  registerBulkIpcHandlers()
  registerTemplatesIpc()
  registerPipelineIpcHandlers(win)
  registerQueryProfilesIpc()
  registerEmailAccountsIpc()
}
