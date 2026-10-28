import type { RequestContext } from 'katal'
import {
  getEmailAccounts,
  addEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  getRawEmailAccountById,
} from '../../db/queries/email-accounts.queries'
import { verifySmtp } from '@sdk/core/outreach/smtp-sender'
import { sendError, HttpStatus } from '../../common'

export class EmailAccountController {
  /**
   * GET /api/email-accounts
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const accounts = await getEmailAccounts()
      return c.json(accounts)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/email-accounts
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
      const body = await c.req.json()
      const account = await addEmailAccount(body)
      return c.json(account, 201)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * PUT /api/email-accounts/:id
   */
  static async update(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const body = await c.req.json()
      await updateEmailAccount(id, body)
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/email-accounts/:id
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      await deleteEmailAccount(id)
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/email-accounts/:id/test
   */
  static async test(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const account = await getRawEmailAccountById(id)
      if (!account) return c.json({ ok: false, error: 'Account not found' }, 404)
      const result = await verifySmtp(account)
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
