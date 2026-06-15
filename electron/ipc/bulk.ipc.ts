// electron/ipc/bulk.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { analyzeBatch } from '../analysis'
import { scoreSite } from '../ai/tasks/score-site'
import { getSettings } from '../../src/db/queries/settings.queries'
import { getDataSource } from '../../src/db'
import { getTenantId } from '../../src/db/queries/tenant'
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
import { parseSpintax } from '../outreach/spintax'
import { draftOutreach } from '../ai/tasks/draft-outreach'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../src/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}

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
    requirePermission('run_scraper')
    await runEmailFinderBatch(leadIds, (done, total, leadId) => {
      event.sender.send('emailFinder:progress', { done, total, leadId })
    })
  })

  ipcMain.handle(IPC.EMAIL_VERIFIER_RUN_BATCH, async (event, leadIds: number[]) => {
    requirePermission('run_scraper')
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
    requirePermission('run_scraper')
    await analyzeBatch(leadIds, (done, total, leadId) => {
      event.sender.send(IPC.ANALYSIS_PROGRESS, { done, total, leadId })
    })
  })

  ipcMain.handle(IPC.BULK_SCORE, async (_event, leadIds: number[]) => {
    requirePermission('run_scraper')
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
    requirePermission('manage_settings')
    for (const id of leadIds) {
      const current = await getDataSource().createQueryBuilder()
        .select('status')
        .from('leads', 'leads')
        .where('id = :id', { id })
        .andWhere('org_id = :orgId', { orgId: getTenantId() })
        .getRawOne()
      
      if (current?.status === 'review' || current?.status === 'qualified') {
        await getDataSource().createQueryBuilder()
          .update('leads')
          .set({
            status: 'approved',
            updated_at: () => "datetime('now')"
          })
          .where('id = :id', { id })
          .andWhere('org_id = :orgId', { orgId: getTenantId() })
          .execute()
        await logActivity(id, 'lead_approved', 'Bulk approved')
      }
    }
  })

  ipcMain.handle(IPC.BULK_SCHEDULE_SEQUENCES, async (_event, leadIds: number[], templateId?: number) => {
    requirePermission('send_outreach')
    const settings = await getSettings()
    let template: EmailTemplateEntity | null = null
    
    if (templateId) {
      const tmplRepo = await getDataSource().getRepository(EmailTemplateEntity)
      template = await tmplRepo.findOneBy({ id: templateId, org_id: getTenantId() })
    }

    for (const id of leadIds) {
      try {
        const lead = await getDataSource().createQueryBuilder()
          .select('*')
          .from('leads', 'leads')
          .where('id = :id', { id })
          .andWhere('org_id = :orgId', { orgId: getTenantId() })
          .getRawOne()
          
        if (lead && lead.email) {
          let subject = ''
          let body = ''

          if (template) {
            subject = template.subject
              .replace(/{{business_name}}/gi, lead.business_name || '')
              .replace(/{{city}}/gi, lead.city || '')
              .replace(/{{ai_hook}}/gi, lead.ai_personalized_hook || '')
            
            body = template.body
              .replace(/{{business_name}}/gi, lead.business_name || '')
              .replace(/{{city}}/gi, lead.city || '')
              .replace(/{{ai_hook}}/gi, lead.ai_personalized_hook || '')

            subject = parseSpintax(subject)
            body = parseSpintax(body)
          } else {
            // Draft with AI
            if (settings.openrouter_api_key) {
              const draft = await draftOutreach(
                settings.openrouter_api_key,
                id,
                settings.developer_name || 'Your Name',
                settings.ai_model_email_draft
              )
              subject = draft.subject
              body = draft.email_body
            } else {
              throw new Error("No openrouter api key found to draft email")
            }
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
      } catch (err) {
        console.error(`Failed to schedule sequence for lead ${id}:`, err)
      }
    }
  })
}
