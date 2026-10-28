// electron/ipc/ai.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '@sdk/core/types'
import { scoreSite } from '@sdk/core/ai/tasks/score-site'
import { draftOutreach } from '@sdk/core/ai/tasks/draft-outreach'
import { getSettings } from '../db/queries/settings.queries'

export function registerAiIpcHandlers(): void {
  ipcMain.handle(IPC.AI_SCORE_SITE, async (_event, leadId: number, modelOverride?: string) => {
    const settings = await getSettings()
    return scoreSite(settings, leadId, modelOverride)
  })

  ipcMain.handle(IPC.AI_DRAFT_EMAIL, async (_event, leadId: number, modelOverride?: string) => {
    const settings = await getSettings()
    return draftOutreach(
      settings,
      leadId,
      settings.developer_name ?? 'Your Name',
      modelOverride
    )
  })
}
