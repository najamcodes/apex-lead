import type { RequestContext } from 'katal'
import { wsHub } from '../../ws'
import { analyzeLead, analyzeBatch } from '@sdk/core/analysis'
import { AnalysisRunSchema } from '../../validation/schemas'
import { sendError, HttpStatus } from '../../common'

export class AnalysisController {
  /**
   * POST /api/analysis/lead/:id
   */
  static async analyzeLead(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.params?.id || c.req.param('id')
      const id = Number(paramVal)
      const result = await analyzeLead(id)
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/analysis/batch
   */
  static async analyzeBatch(c: RequestContext): Promise<Response> {
    try {
      const body = (await c.req.json()) || {}
      const parsed = AnalysisRunSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Invalid request body', details: parsed.error.flatten().fieldErrors }, 400)
      }
      const { leadIds } = parsed.data
      await analyzeBatch(leadIds, (done, total, leadId) => {
        wsHub.broadcast('analysis:progress', { done, total, leadId })
      })
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }
}
