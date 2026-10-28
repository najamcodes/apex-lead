import type { Application, Router } from 'katal'
import { ExecuteDagPipelineController } from './ExecuteDagPipelineController'
import { ValidateDagPipelineController } from './ValidateDagPipelineController'
import { PipelineController } from './PipelineController'
import { CustomNodeController } from './CustomNodeController'

export * from './ExecuteDagPipelineController'
export * from './ValidateDagPipelineController'
export * from './PipelineController'
export * from './CustomNodeController'

export function registerPipelineRoutes(app: Application | Router) {
  // DAG execution/validation
  app.post('/api/v1/pipelines/execute-dag', ExecuteDagPipelineController)
  app.post('/api/v1/pipelines/validate-dag', ValidateDagPipelineController)

  // Pipeline Definitions & Execution
  app.get('/api/pipelines/node-types', PipelineController.getNodeTypes)
  app.get('/api/pipelines/templates', PipelineController.getTemplates)
  app.post('/api/pipelines/templates/:templateId/instantiate', PipelineController.instantiateTemplate)
  app.get('/api/pipelines', PipelineController.list)
  app.post('/api/pipelines', PipelineController.create)
  app.get('/api/pipelines/:id', PipelineController.getById)
  app.put('/api/pipelines/:id', PipelineController.update)
  app.delete('/api/pipelines/:id', PipelineController.delete)
  app.post('/api/pipelines/:id/run', PipelineController.run)
  app.post('/api/pipelines/:id/duplicate', PipelineController.duplicate)
  app.get('/api/pipelines/:id/runs', PipelineController.listRuns)

  // Pipeline Runs
  app.get('/api/pipelines/runs/:runId', PipelineController.getRun)
  app.post('/api/pipelines/runs/:runId/replay', PipelineController.replayRun)
  app.post('/api/pipelines/runs/:runId/cancel', PipelineController.cancelRun)
  app.post('/api/pipelines/runs/:runId/pause', PipelineController.pauseRun)
  app.post('/api/pipelines/runs/:runId/resume', PipelineController.resumeRun)

  // Webhooks
  app.post('/api/pipelines/webhook/:slug', PipelineController.triggerWebhook)

  // Custom Nodes (/api/custom-nodes/*)
  app.get('/api/custom-nodes', CustomNodeController.list)
  app.post('/api/custom-nodes', CustomNodeController.create)
  app.get('/api/custom-nodes/:id', CustomNodeController.getById)
  app.put('/api/custom-nodes/:id', CustomNodeController.update)
  app.delete('/api/custom-nodes/:id', CustomNodeController.delete)
  app.post('/api/custom-nodes/:id/test', CustomNodeController.test)
}

export const registerPipelineDagRoutes = registerPipelineRoutes
