import type { Application, Router } from 'katal'
import { TemplateController } from './TemplateController'

export * from './TemplateController'

export function registerTemplateRoutes(app: Application | Router) {
  app.get('/api/templates', TemplateController.list)
  app.post('/api/templates', TemplateController.create)
  app.put('/api/templates/:id', TemplateController.update)
  app.delete('/api/templates/:id', TemplateController.delete)
}
