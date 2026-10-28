import type { RequestContext } from 'katal'
import { wsHub } from '../../ws'
import { runEmailVerifierBatch } from '@sdk/core/email-finder'
import { EmailVerifierBatchSchema } from '../../validation/schemas'
import { sendError, HttpStatus } from '../../common'

export class EmailVerifierController {
  /**
   * POST /api/email-verifier/batch
   */
  static async verifyBatch(c: RequestContext): Promise<Response> {
    try {
      const body = (await c.req.json()) || {}
      const parsed = EmailVerifierBatchSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Invalid request body', details: parsed.error.flatten().fieldErrors }, 400)
      }
      const { leadIds } = parsed.data
      await runEmailVerifierBatch(leadIds, (done, total, leadId) => {
        wsHub.broadcast('emailVerifier:progress', { done, total, leadId })
      })
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }
}
