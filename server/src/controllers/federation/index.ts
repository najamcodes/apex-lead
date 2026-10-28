import type { Application } from 'katal';
import { FederationSearchController } from './FederationSearchController';

export * from './FederationSearchController';

export function registerFederationRoutes(app: Application) {
  app.post('/api/v1/federation/search', FederationSearchController);
}
