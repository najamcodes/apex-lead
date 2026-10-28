import type { RequestContext } from 'katal'
import { getDataSource } from '../../db'
import { OrganizationEntity } from '../../db/entities/OrganizationEntity'
import { UserEntity } from '../../db/entities/UserEntity'
import { getTenantId, canManageOrg, roleLevel, getCurrentUserId, getCurrentUserRole } from '../../db/queries/tenant'
import {
  getUserOrganizations,
  getOrganizationMembers,
  addUserToOrganization,
  updateUserOrganization,
  removeUserFromOrganization,
  setCurrentOrganization,
  getCurrentUserOrgRole,
  isUserInOrg,
} from '../../db/queries/user-organizations.queries'
import { createToken } from '../../auth'
import { sendError, HttpStatus } from '../../common'

export class OrganizationController {
  /**
   * GET /api/orgs — Get all organizations user belongs to
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const orgs = await getUserOrganizations()
      return c.json({ success: true, organizations: orgs }, 200)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/orgs/current — Get current active organization
   */
  static async getCurrent(c: RequestContext): Promise<Response> {
    try {
      const orgId = getTenantId()
      const repo = getDataSource().getRepository(OrganizationEntity)
      const org = await repo.findOneBy({ id: orgId })
      if (!org) return c.json({ error: 'Organization not found' }, 404)

      const role = await getCurrentUserOrgRole(orgId)
      return c.json({ success: true, organization: { ...org, role } })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/orgs/:id — Get organization by ID
   */
  static async getById(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const repo = getDataSource().getRepository(OrganizationEntity)
      const org = await repo.findOneBy({ id })
      if (!org) return c.json({ error: 'Organization not found' }, 404)

      const isMember = await isUserInOrg(getCurrentUserId(), id)
      if (!isMember && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Access denied' }, 403)
      }

      return c.json({ success: true, organization: org })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/orgs — Create organization (super_admin only)
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
      if (getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Only super admins can create organizations' }, 403)
      }
      const body = await c.req.json()
      const repo = getDataSource().getRepository(OrganizationEntity)
      const org = repo.create(body) as unknown as OrganizationEntity
      await repo.save(org)

      const userOrgModule = await import('../../db/entities/UserOrganizationEntity')
      const userOrgRepo = getDataSource().getRepository(userOrgModule.UserOrganizationEntity)
      await userOrgRepo.save(
        userOrgRepo.create({
          user_id: getCurrentUserId(),
          org_id: org.id,
          role: 'org_admin',
        })
      )

      return c.json({ success: true, organization: org }, 201)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * PUT /api/orgs/:id — Update organization
   */
  static async update(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const body = await c.req.json()

      const role = await getCurrentUserOrgRole(id)
      if (!canManageOrg(role ?? undefined) && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Only org admins can update organization' }, 403)
      }

      const repo = getDataSource().getRepository(OrganizationEntity)
      await repo.update({ id }, body)
      const updated = await repo.findOneBy({ id })
      if (!updated) return c.json({ error: 'Organization not found' }, 404)

      return c.json({ success: true, organization: updated })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/orgs/:id — Delete organization (super_admin only)
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      if (getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Only super admins can delete organizations' }, 403)
      }
      const id = Number(c.params?.id || c.req.param('id'))
      const repo = getDataSource().getRepository(OrganizationEntity)
      await repo.delete({ id })
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/orgs/:id/members — Get organization members
   */
  static async getMembers(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const isMember = await isUserInOrg(getCurrentUserId(), id)
      if (!isMember && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Access denied' }, 403)
      }

      const members = await getOrganizationMembers(id)
      return c.json({ success: true, members })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/orgs/:id/members — Add member to organization
   */
  static async addMember(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const body = await c.req.json()

      const role = await getCurrentUserOrgRole(id)
      if (!canManageOrg(role ?? undefined) && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Only org admins can add members' }, 403)
      }

      if (roleLevel(body.role) >= roleLevel(role ?? '') && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Cannot assign role equal to or higher than your own' }, 403)
      }

      const member = await addUserToOrganization({ ...body, org_id: id })
      return c.json({ success: true, member }, 201)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * PUT /api/orgs/:id/members/:userId — Update member role in organization
   */
  static async updateMember(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const userId = Number(c.params?.userId || c.req.param('userId'))
      const body = await c.req.json()

      const role = await getCurrentUserOrgRole(id)
      if (!canManageOrg(role ?? undefined) && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Only org admins can update members' }, 403)
      }

      if (body.role && roleLevel(body.role) >= roleLevel(role ?? '') && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Cannot assign role equal to or higher than your own' }, 403)
      }

      const member = await updateUserOrganization(id, userId, body)
      if (!member) return c.json({ error: 'Member not found' }, 404)

      return c.json({ success: true, member })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/orgs/:id/members/:userId — Remove member from organization
   */
  static async removeMember(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const userId = Number(c.params?.userId || c.req.param('userId'))

      const role = await getCurrentUserOrgRole(id)
      if (!canManageOrg(role ?? undefined) && getCurrentUserRole() !== 'super_admin') {
        return c.json({ error: 'Only org admins can remove members' }, 403)
      }

      if (userId === getCurrentUserId()) {
        const members = await getOrganizationMembers(id)
        const admins = members.filter((m) => m.role === 'org_admin')
        if (admins.length <= 1) {
          return c.json({ error: 'Cannot remove last org admin' }, 400)
        }
      }

      await removeUserFromOrganization(id, userId)
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/orgs/switch — Switch current active organization
   */
  static async switchOrg(c: RequestContext): Promise<Response> {
    try {
      const { org_id } = await c.req.json()

      const isMember = await isUserInOrg(getCurrentUserId(), org_id)
      if (!isMember) {
        return c.json({ error: 'Not a member of this organization' }, 403)
      }

      await setCurrentOrganization(org_id)

      const userRepo = getDataSource().getRepository(UserEntity)
      const user = await userRepo.findOneBy({ id: getCurrentUserId() })
      const token = await createToken({
        id: user!.id,
        email: user!.email,
        org_id: org_id,
        role: user!.role,
        permissions: JSON.parse(user!.permissions || '[]'),
      })

      return c.json({ success: true, token, org_id })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }
}
