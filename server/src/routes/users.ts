import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getUsersInOrg, createTeamMember, updateUserPermissions, updateUserRole, deleteUser } from '@sdk/backend/db/queries/users.queries'
import { IdParamSchema, UserInsertSchema, UserUpdateSchema } from '../validation/schemas'
import { getCurrentUserRole, canManageOrg, roleLevel } from '@sdk/backend/db/queries/tenant'

export const usersRouter = new OpenAPIHono()

usersRouter.openapi({
  method: 'get',
  path: '/',
  summary: 'List users in organization',
  tags: ['Users'],
  responses: {
    200: { description: 'User list', content: { 'application/json': { schema: z.object({ success: z.boolean(), users: z.array(z.any()) }) } } },
  },
}, async (c) => {
  const users = await getUsersInOrg()
  return c.json({ success: true, users })
})

usersRouter.openapi({
  method: 'post',
  path: '/',
  summary: 'Create team member',
  tags: ['Users'],
  request: {
    body: { content: { 'application/json': { schema: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(['manager', 'user', 'viewer']).default('user'),
      name: z.string().optional(),
    }) } } },
  },
  responses: {
    201: { description: 'User created', content: { 'application/json': { schema: z.object({ success: z.boolean(), user: z.any() }) } } },
    400: { description: 'Invalid request body' },
    403: { description: 'Insufficient permissions to create this role' },
  },
}, async (c) => {
  if (!canManageOrg()) {
    return c.json({ error: 'Only org admins can create team members' }, 403)
  }
  const { email, password, role, name } = await c.req.json()
  const user = await createTeamMember(email, password, role, name)
  return c.json({ success: true, user }, 201)
})

usersRouter.openapi({
  method: 'put',
  path: '/:id/role',
  summary: 'Update user role',
  tags: ['Users'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: z.object({ role: z.enum(['org_admin', 'manager', 'user', 'viewer']) }) } } },
  },
  responses: { 200: { description: 'Role updated' } },
}, async (c) => {
  if (!canManageOrg()) {
    return c.json({ error: 'Only org admins can change roles' }, 403)
  }
  const { id } = c.req.valid('param')
  const { role } = await c.req.json()
  if (roleLevel(role) >= roleLevel(getCurrentUserRole())) {
    return c.json({ error: 'Cannot assign a role equal to or higher than your own' }, 403)
  }
  await updateUserRole(id, role)
  return c.json({ success: true })
})

usersRouter.openapi({
  method: 'put',
  path: '/:id/permissions',
  summary: 'Update user permissions',
  tags: ['Users'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: UserUpdateSchema } } },
  },
  responses: {
    200: { description: 'Permissions updated' },
  },
}, async (c) => {
  if (!canManageOrg()) {
    return c.json({ error: 'Only org admins can update permissions' }, 403)
  }
  const { id } = c.req.valid('param')
  const { permissions } = c.req.valid('json')
  await updateUserPermissions(id, permissions)
  return c.json({ success: true })
})

usersRouter.openapi({
  method: 'delete',
  path: '/:id',
  summary: 'Delete user',
  tags: ['Users'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'User deleted' },
  },
}, async (c) => {
  if (!canManageOrg()) {
    return c.json({ error: 'Only org admins can delete users' }, 403)
  }
  const { id } = c.req.valid('param')
  await deleteUser(id)
  return c.json({ success: true })
})
