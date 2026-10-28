import type { RequestContext } from 'katal'
import { getDataSource } from '../../db'
import { EmailTemplateEntity } from '../../db/entities/EmailTemplateEntity'
import { getTenantId } from '../../db/queries/tenant'
import { sendError, HttpStatus } from '../../common'

export class TemplateController {
  /**
   * GET /api/templates
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const repo = getDataSource().getRepository(EmailTemplateEntity)
      const templates = await repo.find({ where: { org_id: getTenantId() }, order: { created_at: 'DESC' } })
      return c.json(templates)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/templates
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
      const body = await c.req.json()
      const repo = getDataSource().getRepository(EmailTemplateEntity)
      const template = repo.create({ ...body, org_id: getTenantId() })
      const saved = await repo.save(template)
      return c.json(saved, 201)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * PUT /api/templates/:id
   */
  static async update(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const body = await c.req.json()
      const repo = getDataSource().getRepository(EmailTemplateEntity)
      await repo.update({ id, org_id: getTenantId() }, body)
      const updated = await repo.findOneBy({ id, org_id: getTenantId() })
      if (!updated) return c.json({ error: 'Template not found' }, 404)
      return c.json(updated)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/templates/:id
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const repo = getDataSource().getRepository(EmailTemplateEntity)
      await repo.delete({ id, org_id: getTenantId() })
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
