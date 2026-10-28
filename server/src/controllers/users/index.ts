import type { Application, Router } from 'katal'
import { UserController } from './UserController'

export * from './UserController'

export function registerUserRoutes(app: Application | Router) {
  app.get('/api/users', UserController.list)
  app.post('/api/users', UserController.create)
  app.put('/api/users/:id/role', UserController.updateRole)
  app.put('/api/users/:id/permissions', UserController.updatePermissions)
  app.delete('/api/users/:id', UserController.delete)
}
