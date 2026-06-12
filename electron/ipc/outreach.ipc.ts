// electron/ipc/outreach.ipc.ts
import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import {
  sendOutreachRecord,
  processDueOutreach,
  createSequenceForLead,
  initSmtp
} from '../outreach'
import {
  getAllOutreach,
  updateOutreachStatus,
  getSequenceSummaries
} from '../../src/db/queries/outreach.queries'
import { exportLeadsToCsv } from '../outreach/csv-export'
import { getChartData, getFunnelData } from '../../src/db/queries/stats.queries'
import { logActivity } from '../../src/db/queries/activity.queries'
import { verifySmtp } from '../outreach/smtp-sender'
import type { SequenceInput } from '../outreach/sequence-engine'
import { getDataSource } from '../../src/db'

export function registerOutreachIpcHandlers(): void {
  // Send a single outreach record
  ipcMain.handle(IPC.OUTREACH_SEND, async (_event, recordId: number) => {
    return sendOutreachRecord(recordId)
  })

  // Process all due outreach (send scheduled emails)
  ipcMain.handle(IPC.OUTREACH_SEND_BATCH, async () => {
    return processDueOutreach()
  })

  // Get all outreach records
  ipcMain.handle(IPC.OUTREACH_GET_ALL, async (_event, status?: string, pagination?: import('../../src/types').PaginationParams) => {
    return await getAllOutreach(status as any, pagination)
  })

  // Mark a lead as replied
  ipcMain.handle(IPC.OUTREACH_MARK_REPLIED, async (_event, outreachId: number) => {
    await updateOutreachStatus(outreachId, 'replied', { replied_at: new Date().toISOString() })
    const records = await getDataSource().query('SELECT lead_id FROM outreach WHERE id = ?', [outreachId])
    const record = records[0]
    if (record) {
      await getDataSource().query(
        `UPDATE leads SET status = 'replied', updated_at = datetime('now') WHERE id = ?`,
        [record.lead_id]
      )
      await logActivity(record.lead_id, 'email_replied')
    }
  })

  // Mark as bounced
  ipcMain.handle(IPC.OUTREACH_MARK_BOUNCED, async (_event, outreachId: number) => {
    await updateOutreachStatus(outreachId, 'bounced')
    const records = await getDataSource().query('SELECT lead_id FROM outreach WHERE id = ?', [outreachId])
    const record = records[0]
    if (record) await logActivity(record.lead_id, 'email_bounced')
  })

  // Schedule full 3-step sequence for a lead
  ipcMain.handle(
    IPC.OUTREACH_SCHEDULE_SEQ,
    async (_event, input: SequenceInput, businessName: string) => {
      const res = await createSequenceForLead(input, businessName)
      await logActivity(input.lead_id, 'sequence_started', 'Scheduled 3-step sequence')
      return res
    }
  )

  // Get sequence summaries for all leads
  ipcMain.handle(IPC.OUTREACH_GET_SEQUENCES, async (_event, pagination?: import('../../src/types').PaginationParams) => {
    return await getSequenceSummaries(pagination)
  })

  // Export leads to CSV
  ipcMain.handle(IPC.OUTREACH_EXPORT_CSV, async () => exportLeadsToCsv())

  // Chart data
  ipcMain.handle(IPC.STATS_GET_CHART_DATA, async () => ({
    weekly: await getChartData(14),
    funnel: await getFunnelData()
  }))

  // Verify SMTP connection
  ipcMain.handle('smtp:verify', async () => verifySmtp())

  // Re-init SMTP (called after settings save)
  ipcMain.handle('smtp:reinit', () => initSmtp())
}
