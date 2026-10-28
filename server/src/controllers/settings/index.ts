import type { Application, Router } from 'katal'
import { SettingsController } from './SettingsController'

export * from './SettingsController'

export function registerSettingsRoutes(app: Application | Router) {
  app.get('/api/settings', SettingsController.getSettings)
  app.put('/api/settings', SettingsController.updateSettings)
  app.post('/api/auth/login', SettingsController.login)
  app.post('/api/auth/register', SettingsController.register)
  app.post('/api/auth/restore-session', SettingsController.restoreSession)
}
