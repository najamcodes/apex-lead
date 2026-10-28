import type { Application, Router } from 'katal'
import { CollectionController } from './CollectionController'

export * from './CollectionController'

export function registerCollectionRoutes(app: Application | Router) {
  app.get('/api/collections', CollectionController.list)
  app.get('/api/collections/:name', CollectionController.getByName)
  app.put('/api/collections/:name/:id', CollectionController.update)
  app.delete('/api/collections/:name/:id', CollectionController.delete)
  app.post('/api/collections/:name/export', CollectionController.export)
}
