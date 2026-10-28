import type { Application, Router } from 'katal'
import { PluginController } from './PluginController'

export * from './PluginController'

export function registerPluginRoutes(app: Application | Router) {
  app.get('/api/plugins', PluginController.list)
  app.get('/api/plugins/:id', PluginController.getById)
  app.patch('/api/plugins/:id/toggle', PluginController.toggle)
  app.put('/api/plugins/:id/config', PluginController.updateConfig)
  app.post('/api/plugins/:id/test', PluginController.test)
}
