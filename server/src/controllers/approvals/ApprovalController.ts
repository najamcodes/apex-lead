import type { RequestContext } from 'katal'
import { getDataSource } from '../../db'
import { getTenantId } from '../../db/queries/tenant'
import { ApprovalEntity } from '../../db/entities/ApprovalEntity'
import { sendError, HttpStatus } from '../../common'

export class ApprovalController {
  /**
   * GET /api/approvals — list approvals for the current org
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const orgId = getTenantId()
      const status = c.req.query('status') || 'pending'
      const ds = getDataSource()

      const qb = ds.getRepository(ApprovalEntity).createQueryBuilder('a')
        .where('a.org_id = :orgId', { orgId })

      if (status !== 'all') {
        qb.andWhere('a.status = :status', { status })
      }

      qb.orderBy('a.created_at', 'DESC').take(50)

      const items = await qb.getMany()
      const approvals = items.map(a => {
        let parsedRecords: unknown[] = []
        try { parsedRecords = JSON.parse(a.records) } catch {}
        let parsedModified: unknown[] | null = null
        if (a.modified_records) {
          try { parsedModified = JSON.parse(a.modified_records) } catch {}
        }
        return {
          id: a.id,
          pipelineId: a.pipeline_id,
          runId: a.run_id,
          nodeId: a.node_id,
          nodeLabel: a.node_label,
          recordCount: parsedRecords.length,
          sampleRecords: parsedRecords.slice(0, 5),
          records: parsedRecords,
          modifiedRecords: parsedModified,
          status: a.status,
          reviewerNotes: a.reviewer_notes,
          reviewedBy: a.reviewed_by,
          reviewedAt: a.reviewed_at,
          createdAt: a.created_at.toISOString(),
        }
      })

      const pendingCount = await ds.getRepository(ApprovalEntity).count({
        where: { org_id: orgId, status: 'pending' },
      })

      return c.json({ approvals, pendingCount })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/approvals/:id — get specific approval details
   */
  static async getById(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const orgId = getTenantId()
      const ds = getDataSource()

      const approval = await ds.getRepository(ApprovalEntity).findOneBy({ id, org_id: orgId })
      if (!approval) return c.json({ error: 'Approval request not found' }, 404)

      let parsedRecords: unknown[] = []
      try { parsedRecords = JSON.parse(approval.records) } catch {}
      let parsedModified: unknown[] | null = null
      if (approval.modified_records) {
        try { parsedModified = JSON.parse(approval.modified_records) } catch {}
      }

      return c.json({
        id: approval.id,
        pipelineId: approval.pipeline_id,
        runId: approval.run_id,
        nodeId: approval.node_id,
        nodeLabel: approval.node_label,
        records: parsedRecords,
        modifiedRecords: parsedModified,
        status: approval.status,
        reviewerNotes: approval.reviewer_notes,
        reviewedBy: approval.reviewed_by,
        reviewedAt: approval.reviewed_at,
        createdAt: approval.created_at.toISOString(),
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/approvals/:id/action — approve or reject pending checkpoint
   */
  static async resolveAction(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const orgId = getTenantId()
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
      const action = body.action as 'approve' | 'reject'
      const modifiedRecords = body.modifiedRecords
      const reviewerNotes = (body.reviewerNotes as string) || ''

      if (action !== 'approve' && action !== 'reject') {
        return c.json({ error: 'Invalid action. Must be "approve" or "reject".' }, 400)
      }

      const ds = getDataSource()
      const repo = ds.getRepository(ApprovalEntity)
      const approval = await repo.findOneBy({ id, org_id: orgId })

      if (!approval) return c.json({ error: 'Approval request not found' }, 404)
      if (approval.status !== 'pending') {
        return c.json({ error: `Approval already resolved as ${approval.status}` }, 400)
      }

      approval.status = action === 'approve' ? 'approved' : 'rejected'
      approval.reviewed_at = new Date().toISOString()
      approval.reviewer_notes = reviewerNotes || approval.reviewer_notes
      if (modifiedRecords && Array.isArray(modifiedRecords)) {
        approval.modified_records = JSON.stringify(modifiedRecords)
      }

      await repo.save(approval)
      return c.json({ success: true, status: approval.status })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
