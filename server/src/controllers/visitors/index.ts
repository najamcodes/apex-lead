import type { Application } from 'katal';
import { TrackVisitorController } from './TrackVisitorController';
import { RegisterSiteController } from './RegisterSiteController';
import { ListSitesController } from './ListSitesController';

export * from './TrackVisitorController';
export * from './RegisterSiteController';
export * from './ListSitesController';

export function registerVisitorRoutes(app: Application) {
  app.post('/api/v1/track', TrackVisitorController);
  app.post('/api/v1/sites', RegisterSiteController);
  app.get('/api/v1/sites', ListSitesController);
}
