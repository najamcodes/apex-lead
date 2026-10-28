import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import { IPC, type PaginationParams } from '@sdk/core/types'
import {
  sendOutreachRecord,
  processDueOutreach,
  createSequenceForLead,
  initSmtp
} from '@sdk/core/outreach'
import { exportLeadsToCsv as generateCsv } from '@sdk/core/outreach/csv-export'
import {
  getAllOutreach,
  updateOutreachStatus,
  getSequenceSummaries,
  getPendingOutreachQueue
} from '../db/queries/outreach.queries'
import { getChartData, getFunnelData } from '../db/queries/stats.queries'
import { logActivity } from '../db/queries/activity.queries'

import type { SequenceInput } from '@sdk/core/outreach/sequence-engine'
import { getDataSource } from '../db'
import { requirePermission } from '../db/queries/tenant'

export function registerOutreachIpcHandlers(): void {
  // Send a single outreach record
  ipcMain.handle(IPC.OUTREACH_SEND, async (_event, recordId: number) => {
    requirePermission('send_outreach')
    return sendOutreachRecord(recordId)
  })

  // Process all due outreach (send scheduled emails)
  ipcMain.handle(IPC.OUTREACH_SEND_BATCH, async () => {
    requirePermission('send_outreach')
    return processDueOutreach()
  })

  // Get all outreach records
  ipcMain.handle(IPC.OUTREACH_GET_ALL, async (_event, status?: string, pagination?: PaginationParams) => {
    return await getAllOutreach(status as any, pagination)
  })

  // Mark a lead as replied
  ipcMain.handle(IPC.OUTREACH_MARK_REPLIED, async (_event, outreachId: number) => {
    requirePermission('send_outreach')
    await updateOutreachStatus(outreachId, 'replied', { replied_at: new Date().toISOString() })
    const record = await getDataSource().createQueryBuilder()
      .select('lead_id')
      .from('outreach', 'o')
      .where('id = :id', { id: outreachId })
      .getRawOne()
      
    if (record) {
      await getDataSource().createQueryBuilder()
        .update('leads')
        .set({
          status: 'replied',
          updated_at: () => "datetime('now')"
        })
        .where('id = :id', { id: record.lead_id })
        .execute()
      await logActivity(record.lead_id, 'email_replied')
    }
  })

  // Mark as bounced
  ipcMain.handle(IPC.OUTREACH_MARK_BOUNCED, async (_event, outreachId: number) => {
    requirePermission('send_outreach')
    await updateOutreachStatus(outreachId, 'bounced')
    const record = await getDataSource().createQueryBuilder()
      .select('lead_id')
      .from('outreach', 'o')
      .where('id = :id', { id: outreachId })
      .getRawOne()
    if (record) await logActivity(record.lead_id, 'email_bounced')
  })

  // Schedule full 3-step sequence for a lead
  ipcMain.handle(
    IPC.OUTREACH_SCHEDULE_SEQ,
    async (_event, input: SequenceInput, businessName: string) => {
      requirePermission('send_outreach')
      const res = await createSequenceForLead(input, businessName)
      await logActivity(input.lead_id, 'sequence_started', 'Scheduled 3-step sequence')
      return res
    }
  )

  // Get sequence summaries for all leads
  ipcMain.handle(IPC.OUTREACH_GET_SEQUENCES, async (_event, pagination?: PaginationParams) => {
    return await getSequenceSummaries(pagination)
  })

  // Export leads to CSV
  ipcMain.handle(IPC.OUTREACH_EXPORT_CSV, async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Leads',
      defaultPath: `leadhunter-export-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    const csv = await generateCsv()
    fs.writeFileSync(filePath, csv, 'utf8')
    return filePath
  })

  // Chart data
  ipcMain.handle(IPC.STATS_GET_CHART_DATA, async () => ({
    weekly: await getChartData(14),
    funnel: await getFunnelData()
  }))

  ipcMain.handle('outreach:getPendingQueue', async () => {
    return await getPendingOutreachQueue()
  })


  // Re-init SMTP (called after settings save)
  ipcMain.handle('smtp:reinit', () => initSmtp())

  // Verify SMTP connection
  ipcMain.handle('smtp:verify', async (_event, config) => {
    try {
      const { verifySmtp } = await import('@sdk/core/outreach')
      if (config) {
        return await verifySmtp(config)
      }
      const { getEmailAccounts } = await import('../db/queries/email-accounts.queries')
      const accounts = await getEmailAccounts()
      if (accounts.length === 0) {
        return { ok: false, error: 'No email accounts configured' }
      }
      return await verifySmtp(accounts[0] as any)
    } catch (err: any) {
      return { ok: false, error: err.message || 'SMTP verification failed' }
    }
  })
}

