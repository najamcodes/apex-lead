import type { Application, Router } from 'katal'
import { LeadController } from './LeadController'

export * from './LeadController'

export function registerLeadRoutes(app: Application | Router) {
  // /api/leads
  app.get('/api/leads', LeadController.getAll)
  app.post('/api/leads', LeadController.create)
  app.post('/api/leads/batch', LeadController.batchCreate)
  app.get('/api/leads/:id', LeadController.getById)
  app.patch('/api/leads/:id/status', LeadController.updateStatus)
  app.delete('/api/leads/:id', LeadController.delete)

  // /api/stats
  app.get('/api/stats/dashboard', LeadController.getDashboardStats)
  app.get('/api/stats/city-roi', LeadController.getCityRoiStats)
  app.get('/api/stats/chart-data', LeadController.getChartData)
}
