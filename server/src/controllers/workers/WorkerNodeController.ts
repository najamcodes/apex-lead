import type { RequestContext } from 'katal'
import { getDataSource } from '../../db'
import { WorkerNodeEntity } from '../../db/entities/WorkerNodeEntity'
import { workerHub } from '../../ws/worker-hub'
import { getCurrentOrgId, getCurrentUserId, canManageOrg } from '../../context'
import { sendError, HttpStatus } from '../../common'

export class WorkerNodeController {
  /**
   * GET /api/workers — List all registered worker nodes for current organization
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const orgId = getCurrentOrgId()
      const repo = getDataSource().getRepository(WorkerNodeEntity)

      const workers = await repo.find({
        where: { org_id: orgId },
        order: { status: 'ASC', updated_at: 'DESC' },
      })

      const liveWorkers = workerHub.getLiveWorkers(orgId)
      const liveMap = new Map(liveWorkers.map((w) => [w.workerId, w]))

      const list = workers.map((w) => {
        const live = liveMap.get(w.id)
        return {
          id: w.id,
          name: w.name,
          platform: w.platform,
          status: live ? (live.activeJobs >= live.maxConcurrency ? 'busy' : 'idle') : 'offline',
          capabilities: (() => {
            try {
              return JSON.parse(w.capabilities)
            } catch {
              return []
            }
          })(),
          max_concurrency: w.max_concurrency,
          active_jobs: live ? live.activeJobs : 0,
          ip_address: w.ip_address,
          version: w.version,
          last_heartbeat_at: w.last_heartbeat_at,
          created_at: w.created_at,
        }
      })

      return c.json({
        workers: list,
        summary: {
          total: list.length,
          online: list.filter((w) => w.status !== 'offline').length,
          busy: list.filter((w) => w.status === 'busy').length,
          idle: list.filter((w) => w.status === 'idle').length,
        },
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/workers/token — Generate a Worker Pairing Token for connecting desktop app
   */
  static async generateToken(c: RequestContext): Promise<Response> {
    try {
      const orgId = getCurrentOrgId()
      const userId = getCurrentUserId()

      const payload = {
        org_id: orgId,
        user_id: userId,
        created_at: Date.now(),
      }

      const token = Buffer.from(JSON.stringify(payload)).toString('base64')
      return c.json({ token, org_id: orgId })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * DELETE /api/workers/:id — Unregister / delete an offline worker node
   */
  static async deleteWorker(c: RequestContext): Promise<Response> {
    try {
      if (!canManageOrg()) {
        return c.json({ error: 'Unauthorized: only organization managers can remove worker nodes' }, 403)
      }

      const orgId = getCurrentOrgId()
      const workerId = (c.params?.id || c.req.param('id') || '') as string
      const repo = getDataSource().getRepository(WorkerNodeEntity)

      await repo.delete({ id: workerId, org_id: orgId })
      return c.json({ success: true, workerId })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/workers/dispatch — Dispatch a test or explicit pipeline run to the farm
   */
  static async dispatch(c: RequestContext): Promise<Response> {
    try {
      const orgId = getCurrentOrgId()
      const body = await c.req.json()
      const { runId, pipeline, input, targetWorkerId } = body

      if (!runId || !pipeline) {
        return c.json({ error: 'Missing runId or pipeline definition' }, 400)
      }

      const result = await workerHub.dispatchPipeline(orgId, {
        runId,
        pipeline,
        input: input || {},
        targetWorkerId,
      })

      if (!result.dispatched) {
        return c.json({ success: false, error: result.error }, 400)
      }

      return c.json({ success: true, ...result })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }
}
