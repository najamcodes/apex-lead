import type { RequestContext } from 'katal'
import {
  sendOutreachRecord,
  processDueOutreach,
  createSequenceForLead,
  initSmtp
} from '@sdk/core/outreach'
import {
  getAllOutreach,
  updateOutreachStatus,
  getSequenceSummaries,
  getPendingOutreachQueue
} from '../../db/queries/outreach.queries'
import { exportLeadsToCsv } from '@sdk/core/outreach/csv-export'
import { getChartData, getFunnelData } from '../../db/queries/stats.queries'
import { logActivity } from '../../db/queries/activity.queries'
import { getDataSource } from '../../db'
import { getRawEmailAccountById } from '../../db/queries/email-accounts.queries'
import { verifySmtp } from '@sdk/core/outreach/smtp-sender'
import { EmailAccountEntity } from '../../db/entities/EmailAccountEntity'
import { sendError, HttpStatus } from '../../common'

export class OutreachController {
  /**
   * POST /api/outreach/:id/send
   */
  static async send(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.params?.id || c.req.param('id')
      const id = Number(paramVal)
      const result = await sendOutreachRecord(id)
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/outreach/send-batch
   */
  static async sendBatch(c: RequestContext): Promise<Response> {
    try {
      const result = await processDueOutreach()
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/outreach
   */
  static async getAll(c: RequestContext): Promise<Response> {
    try {
      const q = c.req.query()
      const status = q.status as import('@sdk/core/types').OutreachStatus | undefined
      const pagination: import('@sdk/core/types').PaginationParams = {
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      }
      const result = await getAllOutreach(status, pagination)
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * PATCH /api/outreach/:id/replied
   */
  static async markReplied(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.params?.id || c.req.param('id')
      const id = Number(paramVal)
      await updateOutreachStatus(id, 'replied', { replied_at: new Date().toISOString() })
      const record = await getDataSource().createQueryBuilder()
        .select('lead_id')
        .from('outreach', 'o')
        .where('id = :id', { id })
        .getRawOne()
      if (record) {
        await getDataSource().createQueryBuilder()
          .update('leads')
          .set({ status: 'replied', updated_at: () => "datetime('now')" })
          .where('id = :id', { id: record.lead_id })
          .execute()
        await logActivity(record.lead_id, 'email_replied')
      }
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * PATCH /api/outreach/:id/bounced
   */
  static async markBounced(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.params?.id || c.req.param('id')
      const id = Number(paramVal)
      await updateOutreachStatus(id, 'bounced')
      const record = await getDataSource().createQueryBuilder()
        .select('lead_id')
        .from('outreach', 'o')
        .where('id = :id', { id })
        .getRawOne()
      if (record) await logActivity(record.lead_id, 'email_bounced')
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/outreach/schedule-sequence
   */
  static async scheduleSequence(c: RequestContext): Promise<Response> {
    try {
      const { input, businessName } = await c.req.json()
      const res = await createSequenceForLead(input, businessName)
      return c.json(res)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * GET /api/outreach/sequences
   */
  static async getSequences(c: RequestContext): Promise<Response> {
    try {
      const q = c.req.query()
      const pagination: import('@sdk/core/types').PaginationParams = {
        page: q.page ? Number(q.page) : 1,
        pageSize: q.pageSize ? Number(q.pageSize) : 50,
      }
      const result = await getSequenceSummaries(pagination)
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/outreach/export-csv
   */
  static async exportCsv(c: RequestContext): Promise<Response> {
    try {
      const result = await exportLeadsToCsv()
      return c.json({ csv: result })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/outreach/pending-queue
   */
  static async getPendingQueue(c: RequestContext): Promise<Response> {
    try {
      const result = await getPendingOutreachQueue()
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/outreach/chart-data
   */
  static async getChartData(c: RequestContext): Promise<Response> {
    try {
      const weekly = await getChartData(14)
      const funnel = await getFunnelData()
      return c.json({ weekly, funnel }, 200)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/outreach/smtp/verify
   */
  static async verifySmtp(c: RequestContext): Promise<Response> {
    try {
      const q = c.req.query()
      const accountId = q.accountId ? Number(q.accountId) : undefined
      let account = accountId ? await getRawEmailAccountById(accountId) : null
      if (!account) {
        const userOrgId = (c as { get?: (k: string) => { org_id?: number } }).get?.('user')?.org_id || 1
        const accounts = await getDataSource().getRepository(EmailAccountEntity).find({ where: { org_id: userOrgId } })
        account = accounts[0] || null
      }
      if (!account) return c.json({ ok: false, error: 'No email account found' })
      const result = await verifySmtp(account)
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/outreach/smtp/reinit
   */
  static async reinitSmtp(c: RequestContext): Promise<Response> {
    try {
      initSmtp()
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
