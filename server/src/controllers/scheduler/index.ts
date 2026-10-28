import type { Application, Router } from 'katal'
import { SchedulerController } from './SchedulerController'

export * from './SchedulerController'

export function registerSchedulerRoutes(app: Application | Router) {
  app.get('/api/scheduler/status', SchedulerController.getStatus)
}
