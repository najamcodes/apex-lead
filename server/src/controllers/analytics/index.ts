import type { Application, Router } from 'katal'
import { AnalyticsController } from './AnalyticsController'

export * from './AnalyticsController'

export function registerAnalyticsRoutes(app: Application | Router) {
  app.get('/api/analytics/roi', AnalyticsController.getRoiAnalytics)
}
