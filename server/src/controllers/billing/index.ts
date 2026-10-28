import type { Application } from 'katal';
import { BillingCheckoutController } from './BillingCheckoutController';
import { BillingStatusController } from './BillingStatusController';
import { BillingPortalController } from './BillingPortalController';
import { PolarWebhookController } from './PolarWebhookController';

export * from './BillingCheckoutController';
export * from './BillingStatusController';
export * from './BillingPortalController';
export * from './PolarWebhookController';

export function registerBillingRoutes(app: Application) {
  app.post('/api/v1/billing/checkout', BillingCheckoutController);
  app.get('/api/v1/billing/status', BillingStatusController);
  app.get('/api/v1/billing/portal', BillingPortalController);
}

export function registerWebhookRoutes(app: Application) {
  app.post('/api/v1/billing/webhook/polar', PolarWebhookController);
}
