import type { Application, Router } from 'katal'
import { AIController } from './AIController'
import { AIConnectionController } from './AIConnectionController'

export * from './AIController'
export * from './AIConnectionController'

export function registerAIRoutes(app: Application | Router) {
  // /api/ai/*
  app.post('/api/ai/score-site', AIController.scoreSite)
  app.post('/api/ai/draft-email', AIController.draftEmail)
  app.post('/api/ai/test-connection', AIController.testConnection)

  // /api/ai-connections/*
  app.get('/api/ai-connections', AIConnectionController.list)
  app.post('/api/ai-connections', AIConnectionController.create)
  app.get('/api/ai-connections/:id', AIConnectionController.getById)
  app.put('/api/ai-connections/:id', AIConnectionController.update)
  app.delete('/api/ai-connections/:id', AIConnectionController.delete)
  app.post('/api/ai-connections/:id/set-default', AIConnectionController.setDefault)
  app.post('/api/ai-connections/:id/test', AIConnectionController.testConnection)
}
