import type { RequestContext } from 'katal';
import {
  getAllSuppressions,
  addSuppression,
  batchAddSuppressions,
  removeSuppression,
  isSuppressed,
} from '../../db/queries/suppression.queries';
import { sendError, HttpStatus } from '../../common';

function resolveOrgIdFromContext(c: RequestContext): number {
  const ctx = c as RequestContext & {
    user?: { id?: string | number; org_id?: number; orgId?: number };
    get?: (key: string) => unknown;
  };
  const user = ctx.user || (ctx.get ? (ctx.get('user') as { org_id?: number; orgId?: number } | undefined) : undefined);
  return user?.org_id || user?.orgId || 1;
}

export class SuppressionController {
  /**
   * GET /api/suppression
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const query = (c.req.valid ? c.req.valid('query') : c.req.query()) as { page?: number; pageSize?: number; search?: string };
      const orgId = resolveOrgIdFromContext(c);
      const result = await getAllSuppressions(orgId, query);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/suppression
   */
  static async add(c: RequestContext): Promise<Response> {
    try {
      const body = c.req.valid ? c.req.valid('json') : await c.req.json();
      const orgId = resolveOrgIdFromContext(c);
      const result = await addSuppression({
        org_id: orgId,
        value: body.value,
        type: body.type,
        reason: body.reason,
      });
      return c.json(result, 201);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/suppression/batch
   */
  static async batchAdd(c: RequestContext): Promise<Response> {
    try {
      const body = c.req.valid ? c.req.valid('json') : await c.req.json();
      const orgId = resolveOrgIdFromContext(c);
      const result = await batchAddSuppressions(body.values, body.type, body.reason, orgId);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * DELETE /api/suppression/:id
   */
  static async remove(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const orgId = resolveOrgIdFromContext(c);
      const success = await removeSuppression(id, orgId);
      return c.json({ success });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/suppression/check
   */
  static async check(c: RequestContext): Promise<Response> {
    try {
      const queryParams = c.req.valid ? c.req.valid('query') : c.req.query();
      const query = typeof queryParams === 'object' && queryParams !== null ? queryParams.query : queryParams;
      const orgId = resolveOrgIdFromContext(c);
      const suppressed = await isSuppressed(query, orgId);
      return c.json({ suppressed });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
