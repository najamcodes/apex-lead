import { describe, it, expect, vi } from 'vitest'
import { registerWaterfallEnricherNode } from '@sdk/backend/nodes/waterfall-enricher-node'
import { registerJobScraperNode } from '@sdk/backend/nodes/job-scraper-node'
import { registerNewsRadarNode } from '@sdk/backend/nodes/news-radar-node'
import { registerLinkedInNode } from '@sdk/backend/nodes/linkedin-node'
import { registerVoiceCallNode } from '@sdk/backend/nodes/voice-call-node'
import { registerCrmUpsertNode } from '@sdk/backend/nodes/crm-upsert-node'
import { registerBatchNode } from '@sdk/backend/nodes/batch-node'
import { getNodeHandler } from '@sdk/backend/engine/registry'
import { waterfallEnrichmentService } from '@sdk/core/enrichment/waterfall-engine'
import type { NodeExecutionContext } from '@sdk/backend/engine/types'

describe('Advanced DAG Workflow Nodes & GTM Capabilities', () => {
  describe('Waterfall Enrichment Service & Node', () => {
    it('should cascade enrich target with email, phone, and trace steps', async () => {
      const result = await waterfallEnrichmentService.cascadeEnrich(
        {
          firstName: 'Guillermo',
          lastName: 'Rauch',
          domain: 'vercel.com',
          company: 'Vercel',
        },
        {
          enrichPhone: true,
          stopOnFirstVerified: true,
        }
      )

      expect(result.email).toBeDefined()
      expect(result.email).toContain('@vercel.com')
      expect(result.phone).toBeDefined()
      expect(result.phoneType).toBe('mobile')
      expect(result.waterfallTrace.length).toBeGreaterThan(0)
      expect(result.winningEmailProvider).toBeDefined()
    })

    it('should execute WaterfallEnricherNode and emit verified and unverified records', async () => {
      registerWaterfallEnricherNode()
      const handler = getNodeHandler('waterfall_enricher' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'wf-1',
        runId: 'run-wf',
        pipelineId: 'p-wf',
        orgId: 1,
        config: {
          firstNameField: 'firstName',
          lastNameField: 'lastName',
          domainField: 'domain',
          enrichPhone: true,
          minScoreThreshold: 50,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { firstName: 'Sam', lastName: 'Altman', domain: 'openai.com', companyName: 'OpenAI' },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs, port = 'main') => {
          emittedByPort[port] = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emittedByPort.main).toHaveLength(1)
      const enrichedLead = emittedByPort.main[0].data
      expect(enrichedLead.email).toBeDefined()
      expect(enrichedLead.email).toContain('@openai.com')
      expect(enrichedLead.phone).toBeDefined()
      expect(enrichedLead.emailVerified).toBe(true)
      expect(enrichedLead.waterfallTrace).toBeDefined()
    })
  })

  describe('JobScraperNode (Career Board Radar)', () => {
    it('should scrape open roles and attach hiring intent velocity to lead', async () => {
      registerJobScraperNode()
      const handler = getNodeHandler('job_scraper' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'job-1',
        runId: 'run-job',
        pipelineId: 'p-job',
        orgId: 1,
        config: {
          companyField: 'companyName',
          domainField: 'domain',
          keywordFilters: 'salesforce, engineer, devops, growth',
          emitMode: 'attach_to_lead',
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { companyName: 'Datadog', domain: 'datadoghq.com' },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs, port = 'main') => {
          emittedByPort[port] = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emittedByPort.main).toHaveLength(1)
      const data = emittedByPort.main[0].data
      expect(data.openJobsCount).toBeGreaterThan(0)
      expect(data.hiringVelocity).toBeDefined()
      expect(data.topOpenRoles).toBeInstanceOf(Array)
      expect(data.hasHiringTrigger).toBe(true)
    })
  })

  describe('NewsRadarNode (Funding & Leadership Triggers)', () => {
    it('should identify funding, PR announcements and leadership triggers', async () => {
      registerNewsRadarNode()
      const handler = getNodeHandler('news_radar' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'news-1',
        runId: 'run-news',
        pipelineId: 'p-news',
        orgId: 1,
        config: {
          companyField: 'companyName',
          domainField: 'domain',
          lookbackDays: 90,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { companyName: 'Stripe', domain: 'stripe.com' },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs, port = 'main') => {
          emittedByPort[port] = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emittedByPort.main).toHaveLength(1)
      const data = emittedByPort.main[0].data
      expect(data.newsEvents).toBeInstanceOf(Array)
      expect(data.intentTriggerCount).toBeGreaterThan(0)
      expect(data.hasRecentTrigger).toBe(true)
    })
  })

  describe('LinkedInNode (Omnichannel Touchpoints)', () => {
    it('should interpolate spintax notes and dispatch LinkedIn actions', async () => {
      registerLinkedInNode()
      const handler = getNodeHandler('linkedin' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'li-1',
        runId: 'run-li',
        pipelineId: 'p-li',
        orgId: 1,
        config: {
          action: 'connection_request',
          linkedinUrlField: 'linkedinUrl',
          messageTemplate: '{Hi|Hello} {{ lead.firstName }}, noticed your work at {{ lead.companyName }}!',
          simulate: true,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: {
              firstName: 'Satya',
              companyName: 'Microsoft',
              linkedinUrl: 'https://www.linkedin.com/in/satyanadella',
            },
            meta: {} as any,
          },
          {
            id: 'rec-2',
            collection: 'leads',
            data: {
              firstName: 'Anonymous',
              companyName: 'Stealth',
              linkedinUrl: '', // Missing
            },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs, port = 'main') => {
          emittedByPort[port] = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emittedByPort.main).toHaveLength(1)
      const touched = emittedByPort.main[0].data
      expect(touched.linkedinTouched).toBe(true)
      expect(touched.lastLinkedInAction.action).toBe('connection_request')
      expect(touched.lastLinkedInAction.sentMessage).toMatch(/Satya.*Microsoft/)

      expect(emittedByPort.missing_profile).toHaveLength(1)
    })
  })

  describe('VoiceCallNode (Conversational Voice AI SDR Caller)', () => {
    it('should dispatch voice AI qualification call and route qualified leads', async () => {
      registerVoiceCallNode()
      const handler = getNodeHandler('voice_call' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'voice-1',
        runId: 'run-voice',
        pipelineId: 'p-voice',
        orgId: 1,
        config: {
          provider: 'retell',
          phoneField: 'phone',
          promptScript: 'Introduce Apex to {{ lead.firstName }} at {{ lead.companyName }}.',
          simulate: true,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: {
              firstName: 'Marc',
              companyName: 'Salesforce',
              phone: '+1 (415) 555-0199',
            },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs, port = 'main') => {
          emittedByPort[port] = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emittedByPort.main).toHaveLength(1)
      const callData = emittedByPort.main[0].data
      expect(callData.lastVoiceCall).toBeDefined()
      expect(callData.lastVoiceCall.durationSeconds).toBeGreaterThan(0)
      expect(callData.lastVoiceCall.transcript).toBeDefined()
      expect(callData.lastVoiceCall.recordingUrl).toContain('https://')
    })
  })

  describe('CrmUpsertNode (HubSpot & Salesforce 2-Way Sync)', () => {
    it('should perform atomic contact and company upsert with mapped properties', async () => {
      registerCrmUpsertNode()
      const handler = getNodeHandler('crm_upsert' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'crm-1',
        runId: 'run-crm',
        pipelineId: 'p-crm',
        orgId: 1,
        config: {
          crm: 'hubspot',
          operation: 'upsert_both',
          emailField: 'email',
          domainField: 'domain',
          companyField: 'companyName',
          propertyMapping: {
            lead_source: 'origin',
            employee_count: 'size',
          },
          simulate: true,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: {
              email: 'tim@apple.com',
              domain: 'apple.com',
              companyName: 'Apple',
              origin: 'Apollo Scraping',
              size: 160000,
            },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs, port = 'main') => {
          emittedByPort[port] = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emittedByPort.main).toHaveLength(1)
      const syncData = emittedByPort.main[0].data
      expect(syncData.crmSynced).toBe(true)
      expect(syncData.crmSync.crm).toBe('hubspot')
      expect(syncData.crmSync.contactId).toContain('hubspot_cnt_')
      expect(syncData.crmSync.companyId).toContain('hubspot_cmp_')
      expect(syncData.crmSync.mappedProperties.lead_source).toBe('Apollo Scraping')
      expect(syncData.crmSync.mappedProperties.employee_count).toBe(160000)
    })
  })

  describe('BatchNode (Partitioning & Throttling)', () => {
    it('should partition large incoming records into discrete tagged chunks', async () => {
      registerBatchNode()
      const handler = getNodeHandler('batch' as any)
      expect(handler).toBeDefined()

      let emitted: any[] = []
      const mockCtx: NodeExecutionContext = {
        nodeId: 'batch-1',
        runId: 'run-batch',
        pipelineId: 'p-batch',
        orgId: 1,
        config: {
          batchSize: 2,
          delayBetweenBatchesMs: 5,
          tagBatches: true,
        },
        input: {},
        incoming: [
          { id: '1', collection: 'leads', data: { name: 'Lead 1' }, meta: {} as any },
          { id: '2', collection: 'leads', data: { name: 'Lead 2' }, meta: {} as any },
          { id: '3', collection: 'leads', data: { name: 'Lead 3' }, meta: {} as any },
          { id: '4', collection: 'leads', data: { name: 'Lead 4' }, meta: {} as any },
          { id: '5', collection: 'leads', data: { name: 'Lead 5' }, meta: {} as any },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => {
          emitted = Array.isArray(recs) ? recs : [recs]
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emitted).toHaveLength(5)
      expect(emitted[0].data.batchIndex).toBe(1)
      expect(emitted[0].data.totalBatches).toBe(3)
      expect(emitted[2].data.batchIndex).toBe(2)
      expect(emitted[4].data.batchIndex).toBe(3)
    })
  })
})
