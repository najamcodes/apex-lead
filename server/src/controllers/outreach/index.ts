import type { Application, Router } from 'katal'
import { OutreachController } from './OutreachController'

export * from './OutreachController'

export function registerOutreachRoutes(app: Application | Router) {
  app.post('/api/outreach/:id/send', OutreachController.send)
  app.post('/api/outreach/send-batch', OutreachController.sendBatch)
  app.get('/api/outreach', OutreachController.getAll)
  app.patch('/api/outreach/:id/replied', OutreachController.markReplied)
  app.patch('/api/outreach/:id/bounced', OutreachController.markBounced)
  app.post('/api/outreach/schedule-sequence', OutreachController.scheduleSequence)
  app.get('/api/outreach/sequences', OutreachController.getSequences)
  app.get('/api/outreach/export-csv', OutreachController.exportCsv)
  app.get('/api/outreach/pending-queue', OutreachController.getPendingQueue)
  app.get('/api/outreach/chart-data', OutreachController.getChartData)
  app.get('/api/outreach/smtp/verify', OutreachController.verifySmtp)
  app.post('/api/outreach/smtp/reinit', OutreachController.reinitSmtp)
}
