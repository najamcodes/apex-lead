import type { RequestContext } from 'katal';
import {
  getUsersInOrg,
  createTeamMember,
  updateUserPermissions,
  updateUserRole,
  deleteUser,
} from '../../db/queries/users.queries';
import { getCurrentUserRole, canManageOrg, roleLevel } from '../../db/queries/tenant';
import { sendError, HttpStatus } from '../../common';

export class UserController {
  /**
   * GET /api/users
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const users = await getUsersInOrg();
      return c.json({ success: true, users });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/users
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
      if (!canManageOrg()) {
        return c.json({ error: 'Only org admins can create team members' }, 403);
      }
      const { email, password, role, name } = await c.req.json();
      const user = await createTeamMember(email, password, role, name);
      return c.json({ success: true, user }, 201);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PUT /api/users/:id/role
   */
  static async updateRole(c: RequestContext): Promise<Response> {
    try {
      if (!canManageOrg()) {
        return c.json({ error: 'Only org admins can change roles' }, 403);
      }
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const { role } = await c.req.json();

      if (roleLevel(role) >= roleLevel(getCurrentUserRole())) {
        return c.json({ error: 'Cannot assign a role equal to or higher than your own' }, 403);
      }
      await updateUserRole(id, role);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PUT /api/users/:id/permissions
   */
  static async updatePermissions(c: RequestContext): Promise<Response> {
    try {
      if (!canManageOrg()) {
        return c.json({ error: 'Only org admins can update permissions' }, 403);
      }
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const body = c.req.valid ? c.req.valid('json') : await c.req.json();
      const permissions = body?.permissions || [];

      await updateUserPermissions(id, permissions);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * DELETE /api/users/:id
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      if (!canManageOrg()) {
        return c.json({ error: 'Only org admins can delete users' }, 403);
      }
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      await deleteUser(id);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
