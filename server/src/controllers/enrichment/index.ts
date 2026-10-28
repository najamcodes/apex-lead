import type { Application } from 'katal';
import { WaterfallEnrichmentController } from './WaterfallEnrichmentController';

export * from './WaterfallEnrichmentController';

export function registerEnrichmentRoutes(app: Application) {
  app.post('/api/v1/enrichment/waterfall', WaterfallEnrichmentController);
}
