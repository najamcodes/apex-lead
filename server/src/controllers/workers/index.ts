import type { Application, Router } from 'katal'
import { RegisterEdgeWorkerController } from './RegisterEdgeWorkerController'
import { WorkerHeartbeatController } from './WorkerHeartbeatController'
import { WorkerPollChunkController } from './WorkerPollChunkController'
import { WorkerChunkResultController } from './WorkerChunkResultController'
import { ListConnectedWorkersController } from './ListConnectedWorkersController'
import { WorkerNodeController } from './WorkerNodeController'

export * from './RegisterEdgeWorkerController'
export * from './WorkerHeartbeatController'
export * from './WorkerPollChunkController'
export * from './WorkerChunkResultController'
export * from './ListConnectedWorkersController'
export * from './WorkerNodeController'

export function registerWorkerRoutes(app: Application | Router) {
  // Edge worker endpoints
  app.post('/api/v1/workers/register', RegisterEdgeWorkerController)
  app.post('/api/v1/workers/heartbeat', WorkerHeartbeatController)
  app.post('/api/v1/workers/poll', WorkerPollChunkController)
  app.post('/api/v1/workers/chunk-result', WorkerChunkResultController)
  app.get('/api/v1/workers/nodes', ListConnectedWorkersController)

  // Worker farm management endpoints
  app.get('/api/workers', WorkerNodeController.list)
  app.post('/api/workers/token', WorkerNodeController.generateToken)
  app.delete('/api/workers/:id', WorkerNodeController.deleteWorker)
  app.post('/api/workers/dispatch', WorkerNodeController.dispatch)
}
