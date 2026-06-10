// electron/ipc/ai.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { scoreSite } from '../ai/tasks/score-site'
import { draftOutreach } from '../ai/tasks/draft-outreach'
import { getSettings } from '../../src/db/queries/settings.queries'

export function registerAiIpcHandlers(): void {
  ipcMain.handle(IPC.AI_SCORE_SITE, async (_event, leadId: number, modelOverride?: string) => {
    const settings = getSettings()
    return scoreSite(settings.openrouter_api_key, leadId, modelOverride)
  })

  ipcMain.handle(IPC.AI_DRAFT_EMAIL, async (_event, leadId: number, modelOverride?: string) => {
    const settings = getSettings()
    return draftOutreach(
      settings.openrouter_api_key,
      leadId,
      settings.developer_name ?? 'Your Name',
      modelOverride
    )
  })
}
