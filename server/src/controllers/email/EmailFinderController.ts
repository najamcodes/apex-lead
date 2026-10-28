import type { RequestContext } from 'katal'
import { wsHub } from '../../ws'
import { findEmailForLead, runEmailFinderBatch } from '@sdk/core/email-finder'
import { EmailFinderBatchSchema } from '../../validation/schemas'
import { sendError, HttpStatus } from '../../common'

export class EmailFinderController {
  /**
   * POST /api/email-finder/lead/:id
   */
  static async findLeadEmail(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.params?.id || c.req.param('id')
      const id = Number(paramVal)
      const email = await findEmailForLead(id)
      return c.json({ email })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/email-finder/batch
   */
  static async findBatchEmails(c: RequestContext): Promise<Response> {
    try {
      const body = (await c.req.json()) || {}
      const parsed = EmailFinderBatchSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Invalid request body', details: parsed.error.flatten().fieldErrors }, 400)
      }
      const { leadIds } = parsed.data
      await runEmailFinderBatch(leadIds, (done, total, leadId) => {
        wsHub.broadcast('emailFinder:progress', { done, total, leadId })
      })
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }
}
