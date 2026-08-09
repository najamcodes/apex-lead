import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getDataSource } from '../../../backend/db'
import { OrganizationEntity } from '../../../backend/db/entities/OrganizationEntity'
import { ProxyConfigEntity } from '../../../backend/db/entities/ProxyConfigEntity'
import { UserEntity } from '../../../backend/db/entities/UserEntity'
import { getTenantId, canManageOrg, roleLevel, getCurrentUserId, getCurrentUserRole } from '../../../backend/db/queries/tenant'
import {
  getAllProxyConfigs, createProxyConfig, getProxyConfigById, updateProxyConfig, deleteProxyConfig, getProxyConfigForPipeline
} from '../../../backend/db/queries/proxy-configs.queries'
import {
  getUserOrganizations, getOrganizationMembers, addUserToOrganization, updateUserOrganization, removeUserFromOrganization,
  setCurrentOrganization, getCurrentUserOrgRole, isUserInOrg
} from '../../../backend/db/queries/user-organizations.queries'
import { createToken } from '../auth'
import {
  IdParamSchema,
  ProxyConfigInsertSchema,
  ProxyConfigUpdateSchema,
  OrganizationInsertSchema,
  OrganizationUpdateSchema,
  UserOrgInsertSchema,
  UserOrgUpdateSchema,
  SwitchOrgSchema,
} from '../validation/schemas'

// ── Organization Routes ───────────────────────────────────────────────

export const orgRouter = new OpenAPIHono()

// Get all organizations user belongs to
orgRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'List organizations for current user',
  tags: ['Organizations'],
  responses: {
    200: { description: 'List of organizations', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  const orgs = await getUserOrganizations()
  return c.json({ success: true, organizations: orgs })
})

// Get current active organization
orgRouter.openapi({
  method: 'get',
  path: '/current',
  summary: 'Get current active organization',
  tags: ['Organizations'],
  responses: {
    200: { description: 'Current organization', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'No active organization' },
  },
}, async (c) => {
  const orgId = getTenantId()
  const repo = getDataSource().getRepository(OrganizationEntity)
  const org = await repo.findOneBy({ id: orgId })
  if (!org) return c.json({ error: 'Organization not found' }, 404)
  
  // Get user's role in this org
  const role = await getCurrentUserOrgRole(orgId)
  return c.json({ success: true, organization: { ...org, role } })
})

// Get organization by ID
orgRouter.openapi({
  method: 'get',
  path: '/:id',
  summary: 'Get organization details',
  tags: ['Organizations'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Organization details', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Organization not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const repo = getDataSource().getRepository(OrganizationEntity)
  const org = await repo.findOneBy({ id })
  if (!org) return c.json({ error: 'Organization not found' }, 404)
  
  // Check if user is member
  const isMember = await isUserInOrg(getCurrentUserId(), id)
  if (!isMember && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Access denied' }, 403)
  }
  
  return c.json({ success: true, organization: org })
})

// Create organization (super_admin only)
orgRouter.openapi({
  method: 'post',
  path: '/',
  summary: 'Create new organization',
  tags: ['Organizations'],
  request: {
    body: { content: { 'application/json': { schema: OrganizationInsertSchema } } },
  },
  responses: {
    201: { description: 'Organization created', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Insufficient permissions' },
  },
}, async (c) => {
  if (getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Only super admins can create organizations' }, 403)
  }
  const body = c.req.valid('json')
  const repo = getDataSource().getRepository(OrganizationEntity)
  const org = repo.create(body)
  await repo.save(org)
  
  // Add creator as org_admin
  const userOrgRepo = getDataSource().getRepository(await import('../../../backend/db/entities/UserOrganizationEntity').then(m => m.UserOrganizationEntity))
  await userOrgRepo.save(userOrgRepo.create({
    user_id: getCurrentUserId(),
    org_id: org.id,
    role: 'org_admin',
  }))
  
  return c.json({ success: true, organization: org }, 201)
})

// Update organization
orgRouter.openapi({
  method: 'put',
  path: '/:id',
  summary: 'Update organization',
  tags: ['Organizations'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: OrganizationUpdateSchema } } },
  },
  responses: {
    200: { description: 'Organization updated' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Organization not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  
  const role = await getCurrentUserOrgRole(id)
  if (!canManageOrg(role) && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Only org admins can update organization' }, 403)
  }
  
  const repo = getDataSource().getRepository(OrganizationEntity)
  await repo.update({ id }, body)
  const updated = await repo.findOneBy({ id })
  if (!updated) return c.json({ error: 'Organization not found' }, 404)
  
  return c.json({ success: true, organization: updated })
})

// Delete organization (super_admin only)
orgRouter.openapi({
  method: 'delete',
  path: '/:id',
  summary: 'Delete organization',
  tags: ['Organizations'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Organization deleted' },
    403: { description: 'Insufficient permissions' },
  },
}, async (c) => {
  if (getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Only super admins can delete organizations' }, 403)
  }
  const { id } = c.req.valid('param')
  const repo = getDataSource().getRepository(OrganizationEntity)
  await repo.delete({ id })
  return c.json({ success: true })
})

// ── Organization Members ───────────────────────────────────────────────

orgRouter.openapi({
  method: 'get',
  path: '/:id/members',
  summary: 'List organization members',
  tags: ['Organizations'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'List of members', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Access denied' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const isMember = await isUserInOrg(getCurrentUserId(), id)
  if (!isMember && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Access denied' }, 403)
  }
  
  const members = await getOrganizationMembers(id)
  return c.json({ success: true, members })
})

orgRouter.openapi({
  method: 'post',
  path: '/:id/members',
  summary: 'Add member to organization',
  tags: ['Organizations'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: UserOrgInsertSchema } } },
  },
  responses: {
    201: { description: 'Member added', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Insufficient permissions' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  
  const role = await getCurrentUserOrgRole(id)
  if (!canManageOrg(role) && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Only org admins can add members' }, 403)
  }
  
  if (roleLevel(body.role) >= roleLevel(role) && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Cannot assign role equal to or higher than your own' }, 403)
  }
  
  const member = await addUserToOrganization({ ...body, org_id: id })
  return c.json({ success: true, member }, 201)
})

orgRouter.openapi({
  method: 'put',
  path: '/:id/members/:userId',
  summary: 'Update member role/permissions',
  tags: ['Organizations'],
  request: {
    params: z.object({ id: IdParamSchema.shape.id, userId: z.string().transform(Number).pipe(z.number().int().positive()) }),
    body: { content: { 'application/json': { schema: UserOrgUpdateSchema } } },
  },
  responses: {
    200: { description: 'Member updated' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Member not found' },
  },
}, async (c) => {
  const { id, userId } = c.req.valid('param')
  const body = c.req.valid('json')
  
  const role = await getCurrentUserOrgRole(id)
  if (!canManageOrg(role) && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Only org admins can update members' }, 403)
  }
  
  if (body.role && roleLevel(body.role) >= roleLevel(role) && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Cannot assign role equal to or higher than your own' }, 403)
  }
  
  const member = await updateUserOrganization(id, userId, body)
  if (!member) return c.json({ error: 'Member not found' }, 404)
  
  return c.json({ success: true, member })
})

orgRouter.openapi({
  method: 'delete',
  path: '/:id/members/:userId',
  summary: 'Remove member from organization',
  tags: ['Organizations'],
  request: { params: z.object({ id: IdParamSchema.shape.id, userId: z.string().transform(Number).pipe(z.number().int().positive()) }) },
  responses: {
    200: { description: 'Member removed' },
    403: { description: 'Insufficient permissions' },
    404: { description: 'Member not found' },
  },
}, async (c) => {
  const { id, userId } = c.req.valid('param')
  
  const role = await getCurrentUserOrgRole(id)
  if (!canManageOrg(role) && getCurrentUserRole() !== 'super_admin') {
    return c.json({ error: 'Only org admins can remove members' }, 403)
  }
  
  // Prevent self-removal if last org_admin
  if (userId === getCurrentUserId()) {
    const members = await getOrganizationMembers(id)
    const admins = members.filter(m => m.role === 'org_admin')
    if (admins.length <= 1) {
      return c.json({ error: 'Cannot remove last org admin' }, 400)
    }
  }
  
  await removeUserFromOrganization(id, userId)
  return c.json({ success: true })
})

// ── Switch Organization ───────────────────────────────────────────────

orgRouter.openapi({
  method: 'post',
  path: '/switch',
  summary: 'Switch active organization',
  tags: ['Organizations'],
  request: {
    body: { content: { 'application/json': { schema: SwitchOrgSchema } } },
  },
  responses: {
    200: { description: 'Organization switched', content: { 'application/json': { schema: z.any() } } },
    403: { description: 'Not a member of this organization' },
  },
}, async (c) => {
  const { org_id } = c.req.valid('json')
  
  const isMember = await isUserInOrg(getCurrentUserId(), org_id)
  if (!isMember) {
    return c.json({ error: 'Not a member of this organization' }, 403)
  }
  
  await setCurrentOrganization(org_id)
  
  // Generate new token with updated org context
  const userRepo = getDataSource().getRepository(UserEntity)
  const user = await userRepo.findOneBy({ id: getCurrentUserId() })
  const token = await createToken({ id: user!.id, email: user!.email, org_id: org_id, role: user!.role, permissions: JSON.parse(user!.permissions || '[]') })
  
  return c.json({ success: true, token, org_id })
})


// ── Proxy Config Routes ───────────────────────────────────────────────

export const proxyConfigRouter = new OpenAPIHono()

proxyConfigRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'List proxy configurations',
  tags: ['ProxyConfigs'],
  responses: {
    200: { description: 'List of proxy configs', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  const configs = await getAllProxyConfigs()
  return c.json({ success: true, proxy_configs: configs })
})

proxyConfigRouter.openapi({
  method: 'get',
  path: '/:id',
  summary: 'Get proxy configuration by ID',
  tags: ['ProxyConfigs'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Proxy config details', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const config = await getProxyConfigById(id)
  if (!config) return c.json({ error: 'Proxy config not found' }, 404)
  return c.json({ success: true, proxy_config: config })
})

proxyConfigRouter.openapi({
  method: 'post',
  path: '/',
  summary: 'Create proxy configuration',
  tags: ['ProxyConfigs'],
  request: {
    body: { content: { 'application/json': { schema: ProxyConfigInsertSchema } } },
  },
  responses: {
    201: { description: 'Proxy config created', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request' },
  },
}, async (c) => {
  const body = c.req.valid('json')
  const config = await createProxyConfig(body)
  return c.json({ success: true, proxy_config: config }, 201)
})

proxyConfigRouter.openapi({
  method: 'put',
  path: '/:id',
  summary: 'Update proxy configuration',
  tags: ['ProxyConfigs'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: ProxyConfigUpdateSchema } } },
  },
  responses: {
    200: { description: 'Proxy config updated' },
    404: { description: 'Not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const config = await updateProxyConfig(id, body)
  if (!config) return c.json({ error: 'Proxy config not found' }, 404)
  return c.json({ success: true, proxy_config: config })
})

proxyConfigRouter.openapi({
  method: 'delete',
  path: '/:id',
  summary: 'Delete proxy configuration',
  tags: ['ProxyConfigs'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Proxy config deleted' },
    404: { description: 'Not found' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const deleted = await deleteProxyConfig(id)
  if (!deleted) return c.json({ error: 'Proxy config not found' }, 404)
  return c.json({ success: true })
})