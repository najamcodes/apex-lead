import type { Application, Router } from 'katal'
import { EmailFinderController } from './EmailFinderController'
import { EmailVerifierController } from './EmailVerifierController'
import { EmailAccountController } from './EmailAccountController'

export * from './EmailFinderController'
export * from './EmailVerifierController'
export * from './EmailAccountController'

export function registerEmailFinderRoutes(app: Application | Router) {
  app.post('/api/email-finder/lead/:id', EmailFinderController.findLeadEmail)
  app.post('/api/email-finder/batch', EmailFinderController.findBatchEmails)
}

export function registerEmailVerifierRoutes(app: Application | Router) {
  app.post('/api/email-verifier/batch', EmailVerifierController.verifyBatch)
}

export function registerEmailAccountRoutes(app: Application | Router) {
  app.get('/api/email-accounts', EmailAccountController.list)
  app.post('/api/email-accounts', EmailAccountController.create)
  app.put('/api/email-accounts/:id', EmailAccountController.update)
  app.delete('/api/email-accounts/:id', EmailAccountController.delete)
  app.post('/api/email-accounts/:id/test', EmailAccountController.test)
}

export function registerEmailRoutes(app: Application | Router) {
  registerEmailFinderRoutes(app)
  registerEmailVerifierRoutes(app)
  registerEmailAccountRoutes(app)
}
