import '../polyfill';
import { Application } from 'katal';
import { configureContainer } from './container';
import {
  registerAllRoutes,
  HealthController,
} from './controllers';
import { authMiddleware } from './middleware/AuthMiddleware';
import { rateLimit } from './middleware/RateLimitMiddleware';

export function createKatalApp(): Application {
  const app = new Application();

  // Configure container
  configureContainer(app.getContainer());

  // Global rate limiting & optional auth context resolution
  app.use(rateLimit({ windowSeconds: 60, maxRequests: 200 }));
  app.use(authMiddleware({ optional: true }));

  // Health endpoint
  app.get('/health', HealthController);

  // Register all domain controller routes
  registerAllRoutes(app);

  return app;
}

export const katalApp = createKatalApp();
export default katalApp;
