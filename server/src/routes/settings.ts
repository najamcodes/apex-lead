import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { setCookie } from 'hono/cookie'
import { getSettings, saveSettings } from '../../../backend/db/queries/settings.queries'
import { createToken } from '../auth'
import { getDataSource } from '../../../backend/db'
import { UserEntity } from '../../../backend/db/entities/UserEntity'
import { OrganizationEntity } from '../../../backend/db/entities/OrganizationEntity'
import { UserOrganizationEntity } from '../../../backend/db/entities/UserOrganizationEntity'
import { hashPassword, verifyPassword } from '../../../backend/core/utils/crypto'

import { SettingsSchema, AuthLoginSchema, AuthRegisterSchema, AuthRestoreSchema } from '../validation/schemas'

export const settingsRouter = new OpenAPIHono()

settingsRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'Get all settings',
  tags: ['Settings'],
  responses: {
    200: { description: 'Settings object', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const result = await getSettings()
  return c.json(result)
})

settingsRouter.openapi({
  method: 'put',
  path: '/',
  summary: 'Update settings',
  tags: ['Settings'],
  request: {
    body: { content: { 'application/json': { schema: z.any() } } },
  },
  responses: {
    200: { description: 'Settings saved' },
  },
}, async (c) => {
  const body = await c.req.json()
  await saveSettings(body)
  return c.json({ success: true })
})

export const authRouter = new OpenAPIHono()

authRouter.openapi({
  method: 'post',
  path: '/login',
  summary: 'User login',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ email: z.string().email(), password: z.string().min(8) }) } } },
  },
  responses: {
    200: { description: 'Login successful', content: { 'application/json': { schema: z.any() } } },
    401: { description: 'Invalid credentials' },
  },
}, async (c) => {
  const { email, password } = await c.req.json()
  const ds = getDataSource()
  const userRepo = ds.getRepository(UserEntity)
  const userOrgRepo = ds.getRepository(UserOrganizationEntity)
  const orgRepo = ds.getRepository(OrganizationEntity)

  const user = await userRepo.findOneBy({ email })
  if (!user || !verifyPassword(password, user.password_hash)) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401)
  }

  // Find the org to use: default_org_id or first org membership
  let activeOrgId: number = user.default_org_id ?? 1
  let activeRole = user.role
  let activePermissions: string[] = (() => {
    try { return JSON.parse(user.permissions || '[]') } catch { return [] }
  })()

  // Fetch all org memberships for this user
  const orgLinks = await userOrgRepo.find({
    where: { user_id: user.id },
    relations: ['org'],
    order: { created_at: 'ASC' },
  })

  // Determine active org role from org membership
  if (user.role !== 'super_admin' && orgLinks.length > 0) {
    const activeLink = orgLinks.find(l => l.org_id === activeOrgId) ?? orgLinks[0]!
    activeOrgId = activeLink.org_id
    activeRole = activeLink.role
    activePermissions = (() => {
      try { return JSON.parse(activeLink.permissions || '[]') } catch { return [] }
    })()
  }

  // Build organizations list
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
})

authRouter.openapi({
  method: 'post',
  path: '/register',
  summary: 'Register new user and organization',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() }) } } },
  },
  responses: {
    201: { description: 'User registered' },
    409: { description: 'Email already registered' },
  },
}, async (c) => {
  const { email, password, name } = await c.req.json()
  const ds = getDataSource()
  const userRepo = ds.getRepository(UserEntity)
  const orgRepo = ds.getRepository(OrganizationEntity)
  const userOrgRepo = ds.getRepository(UserOrganizationEntity)

  const existing = await userRepo.findOneBy({ email })
  if (existing) return c.json({ success: false, error: 'Email already registered' }, 409)

  // Create a new org for this registrant
  const org = orgRepo.create({
    name: name ? `${name}'s Organization` : 'My Organization',
    tier: 'free',
    max_users: 5,
  })
  await orgRepo.save(org)

  // Create user with org_admin role
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

  // Create user_organizations membership link
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
})

authRouter.openapi({
  method: 'post',
  path: '/restore-session',
  summary: 'Restore user session from cookie',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ userId: z.number().int().positive() }) } } },
  },
  responses: {
    200: { description: 'Session valid' },
    401: { description: 'Session invalid' },
  },
}, async (c) => {
  const { userId } = await c.req.json()
  const user = (c as any).get('user')
  if (user && user.id === userId) return c.json({ success: true })
  return c.json({ success: false, error: 'Session invalid' }, 401)
})