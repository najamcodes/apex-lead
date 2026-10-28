import type { Application, Router } from 'katal'
import { BulkController } from './BulkController'

export * from './BulkController'

export function registerBulkRoutes(app: Application | Router) {
  // Notes
  app.get('/api/bulk/leads/:id/notes', BulkController.getLeadNotes)
  app.put('/api/bulk/leads/:id/notes', BulkController.saveLeadNote)
  app.get('/api/leads/:id/notes', BulkController.getLeadNotes)
  app.put('/api/leads/:id/notes', BulkController.saveLeadNote)

  // Activity
  app.get('/api/bulk/leads/:id/activity', BulkController.getLeadActivity)
  app.get('/api/leads/:id/activity', BulkController.getLeadActivity)
  app.get('/api/bulk/activity/recent', BulkController.getRecentActivity)
  app.get('/api/activity/recent', BulkController.getRecentActivity)

  // Bulk actions
  app.post('/api/bulk/analyze', BulkController.bulkAnalyze)
  app.post('/api/bulk/leads/bulk/analyze', BulkController.bulkAnalyze)
  app.post('/api/bulk/score', BulkController.bulkScore)
  app.post('/api/bulk/leads/bulk/score', BulkController.bulkScore)
  app.post('/api/bulk/approve', BulkController.bulkApprove)
  app.post('/api/bulk/leads/bulk/approve', BulkController.bulkApprove)
  app.post('/api/bulk/schedule-sequences', BulkController.bulkScheduleSequences)
  app.post('/api/bulk/leads/bulk/schedule-sequences', BulkController.bulkScheduleSequences)
}
