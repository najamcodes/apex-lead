import type { Application, Router } from 'katal'
import { AnalysisController } from './AnalysisController'

export * from './AnalysisController'

export function registerAnalysisRoutes(app: Application | Router) {
  app.post('/api/analysis/lead/:id', AnalysisController.analyzeLead)
  app.post('/api/analysis/batch', AnalysisController.analyzeBatch)
}
