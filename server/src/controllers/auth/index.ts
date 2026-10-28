import type { Application } from 'katal';
import { SignupController } from './SignupController';
import { LoginController } from './LoginController';
import { RefreshTokenController } from './RefreshTokenController';
import { GoogleRedirectController } from './GoogleRedirectController';
import { GoogleCallbackController } from './GoogleCallbackController';
import { MeController } from './MeController';
import { LogoutController } from './LogoutController';

export * from './SignupController';
export * from './LoginController';
export * from './RefreshTokenController';
export * from './GoogleRedirectController';
export * from './GoogleCallbackController';
export * from './MeController';
export * from './LogoutController';

export function registerAuthRoutes(app: Application) {
  app.post('/api/v1/auth/signup', SignupController);
  app.post('/api/v1/auth/login', LoginController);
  app.post('/api/v1/auth/refresh', RefreshTokenController);
  app.get('/api/v1/auth/google', GoogleRedirectController);
  app.get('/api/v1/auth/google/callback', GoogleCallbackController);
  app.get('/api/v1/auth/me', MeController);
  app.post('/api/v1/auth/logout', LogoutController);
}
