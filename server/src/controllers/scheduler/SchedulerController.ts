import type { RequestContext } from 'katal'

export class SchedulerController {
  /**
   * GET /api/scheduler/status
   */
  static async getStatus(c: RequestContext): Promise<Response> {
    return c.json({ active: true, time: new Date().toISOString() })
  }
}
