import type { Application, Router } from 'katal'
import { ScraperController } from './ScraperController'

export * from './ScraperController'

export function registerScraperRoutes(app: Application | Router) {
  app.post('/api/scraper/jobs', ScraperController.startJob)
  app.post('/api/scraper/jobs/:id/cancel', ScraperController.cancelJob)
  app.post('/api/scraper/jobs/:id/pause', ScraperController.pauseJob)
  app.post('/api/scraper/jobs/:id/resume', ScraperController.resumeJob)
  app.delete('/api/scraper/jobs/:id', ScraperController.deleteJob)
  app.delete('/api/scraper/jobs', ScraperController.deleteJobs)
  app.get('/api/scraper/jobs', ScraperController.getAllJobs)
}
