import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { setCookie } from 'hono/cookie'
import { getSettings, saveSettings } from '../../../backend/db/queries/settings.queries'
import { createToken } from '../auth'
import { getDataSource } from '../../../backend/db'
import { UserEntity } from '../../../backend/db/entities/UserEntity'
import { OrganizationEntity } from '../../../backend/db/entities/OrganizationEntity'
import crypto from 'crypto'

import { SettingsSchema, AuthLoginSchema, AuthRegisterSchema, AuthRestoreSchema } from '../validation/schemas'

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.includes(':')) {
    if (storedHash === 'local_admin_no_password_yet') return false
    return crypto.createHash('sha256').update(password).digest('hex') === storedHash
  }
  const [salt, key] = storedHash.split(':')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return key === hash
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

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
  const userRepo = getDataSource().getRepository(UserEntity)
  const user = await userRepo.findOneBy({ email })

  if (!user || !verifyPassword(password, user.password_hash)) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401)
  }

  const token = await createToken({ id: user.id, role: user.role })
  setCookie(c, 'leadhunter_token', token, { path: '/', httpOnly: true, sameSite: 'Lax' })
  return c.json({ success: true, user: { id: user.id, email: user.email, role: user.role, org_id: user.org_id } })
})

authRouter.openapi({
  method: 'post',
  path: '/register',
  summary: 'Register new user and organization',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ email: z.string().email(), password: z.string().min(8) }) } } },
  },
  responses: {
    201: { description: 'User registered' },
    409: { description: 'Email already registered' },
  },
}, async (c) => {
  const { email, password } = await c.req.json()
  const userRepo = getDataSource().getRepository(UserEntity)
  const orgRepo = getDataSource().getRepository(OrganizationEntity)

  const existing = await userRepo.findOneBy({ email })
  if (existing) return c.json({ success: false, error: 'Email already registered' }, 409)

  const org = orgRepo.create({ name: 'My Organization' })
  await orgRepo.save(org)

  const hash = crypto.pbkdf2Sync(password, crypto.randomBytes(16).toString('hex'), 10000, 64, 'sha512').toString('hex')
  const user = userRepo.create({
    email,
    password_hash: hash,
    role: 'admin',
    org_id: org.id,
    permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach'])
  })
  await userRepo.save(user)

  const token = await createToken({ id: user.id, role: user.role })
  setCookie(c, 'leadhunter_token', token, { path: '/', httpOnly: true, sameSite: 'Lax' })
  return c.json({ success: true, user: { id: user.id, email: user.email, role: user.role, org_id: user.org_id } }, 201)
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