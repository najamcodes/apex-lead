// electron/ipc/bulk.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { analyzeBatch } from '../analysis'
import { scoreSite } from '../ai/tasks/score-site'
import { getSettings } from '../../src/db/queries/settings.queries'
import { getDb } from '../../src/db'
import { logActivity, getActivityByLead, getRecentActivity } from '../../src/db/queries/activity.queries'
import { getNoteByLead, saveNote } from '../../src/db/queries/notes.queries'
import { runEmailFinderBatch, findEmailForLead } from '../email-finder'
import { createSequenceForLead } from '../outreach'
import { getSchedulerStatus } from '../scheduler'

export function registerBulkIpcHandlers(): void {
  // NOTES
  ipcMain.handle(IPC.NOTES_GET, (_event, leadId: number) => {
    return getNoteByLead(leadId)
  })

  ipcMain.handle(IPC.NOTES_SAVE, (_event, leadId: number, body: string) => {
    logActivity(leadId, 'note_added', 'Added a note to the lead')
    return saveNote(leadId, body)
  })

  // ACTIVITY
  ipcMain.handle(IPC.ACTIVITY_GET, (_event, leadId: number) => {
    return getActivityByLead(leadId)
  })

  ipcMain.handle(IPC.ACTIVITY_GET_RECENT, () => {
    return getRecentActivity()
  })

  // EMAIL FINDER
  ipcMain.handle(IPC.EMAIL_FINDER_RUN, async (_event, leadId: number) => {
    return findEmailForLead(leadId)
  })

  ipcMain.handle(IPC.EMAIL_FINDER_RUN_BATCH, async (event, leadIds: number[]) => {
    await runEmailFinderBatch(leadIds, (done, total, leadId) => {
      event.sender.send('emailFinder:progress', { done, total, leadId })
    })
  })

  // SCHEDULER
  ipcMain.handle(IPC.SCHEDULER_STATUS, () => {
    return getSchedulerStatus()
  })
  
  // BULK ACTIONS
  ipcMain.handle(IPC.BULK_ANALYZE, async (event, leadIds: number[]) => {
    await analyzeBatch(leadIds, (done, total, leadId) => {
      event.sender.send(IPC.ANALYSIS_PROGRESS, { done, total, leadId })
    })
  })

  ipcMain.handle(IPC.BULK_SCORE, async (_event, leadIds: number[]) => {
    const settings = getSettings()
    if (!settings.ai_enabled || !settings.openrouter_api_key) return
    for (const id of leadIds) {
      try {
        await scoreSite(settings.openrouter_api_key, id, settings.ai_model_site_scoring)
        // 1 sec delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1000))
      } catch {
        // ignore
      }
    }
  })

  ipcMain.handle(IPC.BULK_APPROVE, (_event, leadIds: number[]) => {
    const db = getDb()
    for (const id of leadIds) {
      const current = db.prepare('SELECT status FROM leads WHERE id = ?').get(id) as any
      if (current?.status === 'review' || current?.status === 'qualified') {
        db.prepare(`UPDATE leads SET status = 'approved', updated_at = datetime('now') WHERE id = ?`).run(id)
        logActivity(id, 'lead_approved', 'Bulk approved')
      }
    }
  })

  ipcMain.handle(IPC.BULK_SCHEDULE_SEQUENCES, (_event, leadIds: number[], _templateId: number) => {
    const db = getDb()
    for (const id of leadIds) {
      const lead = db.prepare('SELECT business_name, email FROM leads WHERE id = ?').get(id) as any
      // In a real scenario we'd fetch the AI draft for this lead. 
      // For now, we stub it to allow bulk scheduling with a generic fallback template.
      if (lead && lead.email) {
        createSequenceForLead({ 
          lead_id: id,
          email: lead.email,
          subject: 'Question about ' + lead.business_name,
          email_body: 'Hi, I noticed your website might need an update.'
        }, lead.business_name)
      }
    }
  })
}
