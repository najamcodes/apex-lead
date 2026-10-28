import type { Application, Router } from 'katal'
import { registerAuthRoutes } from './auth'
import { registerBillingRoutes, registerWebhookRoutes } from './billing'
import { registerCadenceRoutes } from './cadence'
import { registerWorkerRoutes } from './workers'
import { registerMailboxRoutes } from './mailbox'
import { registerOrganizationRoutes } from './organization'
import { registerPipelineRoutes } from './pipelines'
import { registerRecordRoutes } from './records'
import { registerVisitorRoutes } from './visitors'
import { registerVoiceRoutes } from './voice'
import { registerEnrichmentRoutes } from './enrichment'
import { registerFederationRoutes } from './federation'
import { registerLeadRoutes } from './leads'
import { registerScraperRoutes } from './scraper'
import { registerAnalyticsRoutes } from './analytics'
import { registerAIRoutes } from './ai'
import { registerUserRoutes } from './users'
import { registerSuppressionRoutes } from './suppression'
import { registerBulkRoutes } from './bulk'
import { registerAnalysisRoutes } from './analysis'
import { registerSchedulerRoutes } from './scheduler'
import { registerEmailRoutes } from './email'
import { registerSettingsRoutes } from './settings'
import { registerApprovalRoutes } from './approvals'
import { registerCollectionRoutes } from './collections'
import { registerOutreachRoutes } from './outreach'
import { registerTemplateRoutes } from './templates'
import { registerPluginRoutes } from './plugins'

export * from './auth'
export * from './billing'
export * from './cadence'
export * from './workers'
export * from './mailbox'
export * from './organization'
export * from './pipelines'
export * from './records'
export * from './visitors'
export * from './voice'
export * from './enrichment'
export * from './federation'
export * from './leads'
export * from './scraper'
export * from './analytics'
export * from './ai'
export * from './users'
export * from './suppression'
export * from './bulk'
export * from './health'
export * from './analysis'
export * from './scheduler'
export * from './email'
export * from './settings'
export * from './approvals'
export * from './collections'
export * from './outreach'
export * from './templates'
export * from './plugins'

export function registerAllRoutes(app: Application) {
  registerAuthRoutes(app)
  registerBillingRoutes(app)
  registerWebhookRoutes(app)
  registerCadenceRoutes(app)
  registerWorkerRoutes(app)
  registerMailboxRoutes(app)
  registerOrganizationRoutes(app)
  registerPipelineRoutes(app)
  registerRecordRoutes(app)
  registerVisitorRoutes(app)
  registerVoiceRoutes(app)
  registerEnrichmentRoutes(app)
  registerFederationRoutes(app)
  registerLeadRoutes(app)
  registerScraperRoutes(app)
  registerAnalyticsRoutes(app)
  registerAIRoutes(app)
  registerUserRoutes(app)
  registerSuppressionRoutes(app)
  registerBulkRoutes(app)
  registerAnalysisRoutes(app)
  registerSchedulerRoutes(app)
  registerEmailRoutes(app)
  registerSettingsRoutes(app)
  registerApprovalRoutes(app)
  registerCollectionRoutes(app)
  registerOutreachRoutes(app)
  registerTemplateRoutes(app)
  registerPluginRoutes(app)
}
