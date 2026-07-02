import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { getUsersInOrg, createTeamMember, updateUserPermissions, deleteUser } from '../../../backend/db/queries/users.queries'
import { IdParamSchema, UserInsertSchema, UserUpdateSchema } from '../validation/schemas'

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
    body: { content: { 'application/json': { schema: UserInsertSchema } } },
  },
  responses: {
    201: { description: 'User created', content: { 'application/json': { schema: z.object({ success: z.boolean(), user: z.any() }) } } },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const { email, password } = c.req.valid('json')
  const user = await createTeamMember(email, password)
  return c.json({ success: true, user }, 201)
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
  const { id } = c.req.valid('param')
  await deleteUser(id)
  return c.json({ success: true })
})
