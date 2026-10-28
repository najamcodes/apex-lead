import type { RequestContext } from 'katal'
import { setCookie } from '../../utils/cookies'
import { getSettings, saveSettings } from '../../db/queries/settings.queries'
import { createToken } from '../../auth'
import { getDataSource } from '../../db'
import { UserEntity } from '../../db/entities/UserEntity'
import { OrganizationEntity } from '../../db/entities/OrganizationEntity'
import { UserOrganizationEntity } from '../../db/entities/UserOrganizationEntity'
import { hashPassword, verifyPassword } from '@sdk/core/utils/crypto'
import { sendError, HttpStatus } from '../../common'

export class SettingsController {
  /**
   * GET /api/settings
   */
  static async getSettings(c: RequestContext): Promise<Response> {
    try {
      const result = await getSettings()
      return c.json(result)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * PUT /api/settings
   */
  static async updateSettings(c: RequestContext): Promise<Response> {
    try {
      const body = await c.req.json()
      await saveSettings(body)
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * POST /api/auth/login
   */
  static async login(c: RequestContext): Promise<Response> {
    try {
      const { email, password } = await c.req.json()
      const ds = getDataSource()
      const userRepo = ds.getRepository(UserEntity)
      const userOrgRepo = ds.getRepository(UserOrganizationEntity)
      const orgRepo = ds.getRepository(OrganizationEntity)

      const user = await userRepo.findOneBy({ email })
      if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401)
      }

      let activeOrgId: number = user.default_org_id ?? 1
      let activeRole = user.role
      let activePermissions: string[] = (() => {
        try { return JSON.parse(user.permissions || '[]') } catch { return [] }
      })()

      const orgLinks = await userOrgRepo.find({
        where: { user_id: user.id },
        relations: { org: true },
        order: { created_at: 'ASC' },
      })

      if (user.role !== 'super_admin' && orgLinks.length > 0) {
        const activeLink = orgLinks.find(l => l.org_id === activeOrgId) ?? orgLinks[0]!
        activeOrgId = activeLink.org_id
        activeRole = activeLink.role
        activePermissions = (() => {
          try { return JSON.parse(activeLink.permissions || '[]') } catch { return [] }
        })()
      }

      const organizations = await Promise.all(
        orgLinks.map(async link => {
          const org = link.org ?? await orgRepo.findOneBy({ id: link.org_id })
          return {
            id: link.org_id,
            name: org?.name ?? 'Unknown',
            tier: org?.tier ?? 'free',
            role: link.role,
          }
        })
      )

      const token = await createToken({ id: user.id, email: user.email, org_id: activeOrgId, role: activeRole, permissions: activePermissions })
      setCookie(c, 'leadhunter_token', token, { path: '/', httpOnly: true, sameSite: 'Lax' })
      return c.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: activeRole,
          org_id: activeOrgId,
          permissions: activePermissions,
          name: user.name,
          organizations,
        },
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * POST /api/auth/register
   */
  static async register(c: RequestContext): Promise<Response> {
    try {
      const { email, password, name } = await c.req.json()
      const ds = getDataSource()
      const userRepo = ds.getRepository(UserEntity)
      const orgRepo = ds.getRepository(OrganizationEntity)
      const userOrgRepo = ds.getRepository(UserOrganizationEntity)

      const existing = await userRepo.findOneBy({ email })
      if (existing) return c.json({ success: false, error: 'Email already registered' }, 409)

      const org = orgRepo.create({
        name: name ? `${name}'s Organization` : 'My Organization',
        tier: 'free',
        max_users: 5,
      })
      await orgRepo.save(org)

      const pwdHash = hashPassword(password)
      const user = userRepo.create({
        email,
        password_hash: pwdHash,
        role: 'org_admin',
        default_org_id: org.id,
        name: name ?? null,
        hierarchy_level: 4,
        permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach', 'manage_team']),
      })
      await userRepo.save(user)

      const link = userOrgRepo.create({
        user_id: user.id,
        org_id: org.id,
        role: 'org_admin',
        permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach', 'manage_team']),
        is_default: true,
      })
      await userOrgRepo.save(link)

      const token = await createToken({ id: user.id, email: user.email, org_id: org.id, role: 'org_admin', permissions: JSON.parse(user.permissions) })
      setCookie(c, 'leadhunter_token', token, { path: '/', httpOnly: true, sameSite: 'Lax' })
      return c.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: 'org_admin',
          org_id: org.id,
          permissions: JSON.parse(user.permissions),
          name: user.name,
          organizations: [{ id: org.id, name: org.name, tier: org.tier, role: 'org_admin' }],
        },
      }, 201)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * POST /api/auth/restore-session
   */
  static async restoreSession(c: RequestContext): Promise<Response> {
    try {
      const { userId } = await c.req.json()
      const user = (c as { get?: (k: string) => { id?: number } }).get?.('user')
      if (user && user.id === userId) return c.json({ success: true })
      return c.json({ success: false, error: 'Session invalid' }, 401)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.UNAUTHORIZED)
    }
  }
}
