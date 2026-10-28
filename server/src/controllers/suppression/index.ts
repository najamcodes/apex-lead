import type { Application, Router } from 'katal'
import { SuppressionController } from './SuppressionController'

export * from './SuppressionController'

export function registerSuppressionRoutes(app: Application | Router) {
  app.get('/api/suppression', SuppressionController.list)
  app.post('/api/suppression', SuppressionController.add)
  app.post('/api/suppression/batch', SuppressionController.batchAdd)
  app.delete('/api/suppression/:id', SuppressionController.remove)
  app.get('/api/suppression/check', SuppressionController.check)
}
