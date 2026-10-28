import type { Application, Router } from 'katal'
import { ApprovalController } from './ApprovalController'

export * from './ApprovalController'

export function registerApprovalRoutes(app: Application | Router) {
  app.get('/api/approvals', ApprovalController.list)
  app.get('/api/approvals/:id', ApprovalController.getById)
  app.post('/api/approvals/:id/action', ApprovalController.resolveAction)
}
