// electron/ipc/bulk.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { analyzeBatch } from '../analysis'
import { scoreSite } from '../ai/tasks/score-site'
import { getSettings } from '../../src/db/queries/settings.queries'
import { getDataSource } from '../../src/db'
import {
  logActivity,
  getActivityByLead,
  getRecentActivity
} from '../../src/db/queries/activity.queries'
import { getNoteByLead, saveNote } from '../../src/db/queries/notes.queries'
import { EmailTemplateEntity } from '../../src/db/entities/EmailTemplateEntity'
import { runEmailFinderBatch, findEmailForLead, runEmailVerifierBatch } from '../email-finder'
import { createSequenceForLead } from '../outreach'
import { getSchedulerStatus } from '../scheduler'

export function registerBulkIpcHandlers(): void {
  // NOTES
  ipcMain.handle(IPC.NOTES_GET, (_event, leadId: number) => {
    return getNoteByLead(leadId)
  })

  ipcMain.handle(IPC.NOTES_SAVE, async (_event, leadId: number, body: string) => {
    await logActivity(leadId, 'note_added', 'Added a note to the lead')
    return await saveNote(leadId, body)
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

  ipcMain.handle(IPC.EMAIL_VERIFIER_RUN_BATCH, async (event, leadIds: number[]) => {
    await runEmailVerifierBatch(leadIds, (done, total, leadId) => {
      event.sender.send('emailVerifier:progress', { done, total, leadId })
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
    const settings = await getSettings()
    if (!settings.ai_enabled || !settings.openrouter_api_key) return
    for (const id of leadIds) {
      try {
        await scoreSite(settings.openrouter_api_key, id, settings.ai_model_site_scoring)
        // 1 sec delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 1000))
      } catch {
        // ignore
      }
    }
  })

  ipcMain.handle(IPC.BULK_APPROVE, async (_event, leadIds: number[]) => {
    for (const id of leadIds) {
      const results = await getDataSource().query('SELECT status FROM leads WHERE id = ?', [id])
      const current = results[0]
      if (current?.status === 'review' || current?.status === 'qualified') {
        await getDataSource().query(
          `UPDATE leads SET status = 'approved', updated_at = datetime('now') WHERE id = ?`,
          [id]
        )
        await logActivity(id, 'lead_approved', 'Bulk approved')
      }
    }
  })

  ipcMain.handle(IPC.BULK_SCHEDULE_SEQUENCES, async (_event, leadIds: number[], templateId: number) => {
    let template: EmailTemplateEntity | null = null
    if (templateId) {
      template = await getDataSource()
        .getRepository(EmailTemplateEntity)
        .findOneBy({ id: templateId })
    }

    for (const id of leadIds) {
      const results = await getDataSource().query('SELECT business_name, email FROM leads WHERE id = ?', [id])
      const lead = results[0]
      if (lead && lead.email) {
        let subject = 'Question about ' + lead.business_name
        let body = 'Hi, I noticed your website might need an update.'

        if (template) {
          subject = template.subject.replace(/{{business_name}}/g, lead.business_name)
          body = template.body.replace(/{{business_name}}/g, lead.business_name)
        }

        await createSequenceForLead(
          {
            lead_id: id,
            email: lead.email,
            subject,
            email_body: body
          },
          lead.business_name
        )
      }
    }
  })
}
