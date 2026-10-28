import { describe, it, expect } from 'vitest'
import { registerTechnographicNode } from '@sdk/core/nodes/technographic-node'
import { registerDnsHealthNode, auditDomainDns } from '@sdk/core/nodes/dns-health-node'
import { registerPersonalizerNode, generateIcebreaker } from '@sdk/core/nodes/personalizer-node'
import { registerChannelRouterNode } from '@sdk/core/nodes/channel-router-node'
import { registerWebhookDispatcherNode, computeHmacSignature } from '@sdk/core/nodes/webhook-dispatcher-node'
import { registerExportNode, recordsToCsv, recordsToNdjson } from '@sdk/core/nodes/export-node'
import { cleanCompanyName, splitFullName } from '@sdk/core/nodes/format-node'
import { registerFilterNode } from '@sdk/core/nodes/filter-node'
import { registerCodeNode } from '@sdk/core/nodes/code-node'
import { getNodeHandler } from '@sdk/core/engine/registry'
import { detectTechFromHtml } from '@sdk/core/analysis/wappalyzer'
import type { NodeExecutionContext } from '@sdk/core/engine/types'

describe('New GTM Nodes & Engine Modernization Suite', () => {
  // ── 1. Technographic Analyzer & Node ─────────────────────────────
  describe('TechnographicRadarNode & HTML Detection Engine', () => {
    it('should detect tech stack directly from raw HTML and headers', () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="generator" content="WordPress 6.4.2" />
          <script src="https://cdn.shopify.com/s/files/1/0000/shop.js"></script>
          <script src="https://js.stripe.com/v3/"></script>
          <script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>
          <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC12345"></script>
        </head>
        <body class="bg-slate-900 text-white flex items-center justify-between">
          <div data-reactroot="">Hello Shop</div>
        </body>
        </html>
      `
      const headers = {
        server: 'cloudflare',
        'cf-ray': '123456789-DFW',
      }

      const detected = detectTechFromHtml(sampleHtml, headers)
      const names = detected.map((d) => d.name)

      expect(names).toContain('Shopify')
      expect(names).toContain('WordPress')
      expect(names).toContain('Stripe')
      expect(names).toContain('Klaviyo')
      expect(names).toContain('Google Analytics')
      expect(names).toContain('Tailwind CSS')
      expect(names).toContain('React')
      expect(names).toContain('Cloudflare')
    })

    it('should execute TechnographicRadarNode in simulation mode and branch by target technologies', async () => {
      registerTechnographicNode()
      const handler = getNodeHandler('technographic' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'tech-1',
        runId: 'run-tech',
        pipelineId: 'p-tech',
        orgId: 1,
        config: {
          domainField: 'domain',
          targetTechnologies: 'Shopify, Stripe',
          matchMode: 'all',
          simulate: true,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { companyName: 'Gymshark', domain: 'gymshark.com' },
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
      expect(data.technologies).toContain('Shopify')
      expect(data.technologies).toContain('Stripe')
      expect(data.hasTargetTech).toBe(true)
      expect(data.isMobileResponsive).toBe(true)
      expect(emittedByPort.matched).toHaveLength(1)
    })
  })

  // ── 2. DNS Health & Cold Deliverability Node ─────────────────────
  describe('DnsHealthNode & Deliverability Scoring', () => {
    it('should audit simulated domain and return high deliverability score', async () => {
      const audit = await auditDomainDns('google.com', true)
      expect(audit.deliverabilityScore).toBeGreaterThanOrEqual(90)
      expect(audit.hasSpf).toBe(true)
      expect(audit.hasDmarc).toBe(true)
      expect(audit.hasMx).toBe(true)
      expect(audit.riskLevel).toBe('low')
      expect(audit.primaryMailProvider).toBe('Google Workspace')
    })

    it('should execute DnsHealthNode and route healthy vs risky domains', async () => {
      registerDnsHealthNode()
      const handler = getNodeHandler('dns_health' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'dns-1',
        runId: 'run-dns',
        pipelineId: 'p-dns',
        orgId: 1,
        config: {
          domainField: 'domain',
          minScore: 70,
          simulate: true,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { companyName: 'Acme', domain: 'acme.org' },
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
      expect(data.isDeliverable).toBe(true)
      expect(data.deliverabilityScore).toBeGreaterThanOrEqual(70)
      expect(emittedByPort.healthy).toHaveLength(1)
    })
  })

  // ── 3. Personalizer Node ─────────────────────────────────────────
  describe('PersonalizerNode & Intent-Driven Icebreaker Generator', () => {
    it('should generate hiring-velocity hook when open positions exist', () => {
      const hook = generateIcebreaker({
        firstName: 'Sarah',
        companyName: 'Notion',
        openJobsCount: 12,
        topOpenRoles: ['Senior Staff Engineer', 'Head of Product'],
      })

      expect(hook.angle).toBe('hiring_intent')
      expect(hook.icebreaker).toContain('Notion')
      expect(hook.icebreaker).toContain('12 open')
      expect(hook.psLine).toContain('Senior Staff Engineer')
    })

    it('should generate technographic hook when technologies are detected', () => {
      const hook = generateIcebreaker({
        firstName: 'Alex',
        companyName: 'Allbirds',
        technologies: ['Shopify Plus', 'Klaviyo', 'Segment'],
      })

      expect(hook.angle).toBe('technographic')
      expect(hook.icebreaker).toContain('Allbirds')
      expect(hook.icebreaker).toContain('Shopify Plus and Klaviyo')
      expect(hook.psLine).toContain('Shopify Plus')
    })

    it('should execute PersonalizerNode and enrich records with personalized hooks', async () => {
      registerPersonalizerNode()
      const handler = getNodeHandler('personalizer' as any)
      expect(handler).toBeDefined()

      let emitted: any[] = []
      const mockCtx: NodeExecutionContext = {
        nodeId: 'pers-1',
        runId: 'run-pers',
        pipelineId: 'p-pers',
        orgId: 1,
        config: {
          tone: 'growth_focused',
          outputField: 'icebreaker',
          psField: 'psLine',
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: {
              firstName: 'Brian',
              companyName: 'Airbnb',
              title: 'CEO',
              outreachBody: 'Would love to discuss AI travel agents.',
            },
            meta: {} as any,
          },
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

      expect(emitted).toHaveLength(1)
      const data = emitted[0].data
      expect(data.icebreaker).toBeDefined()
      expect(data.psLine).toBeDefined()
      expect(data.personalizedHook).toContain('Would love to discuss AI travel agents.')
    })
  })

  // ── 4. Channel Router Node ───────────────────────────────────────
  describe('ChannelRouterNode (Omnichannel Routing)', () => {
    it('should route leads to voice, email, and linkedin based on verified data availability', async () => {
      registerChannelRouterNode()
      const handler = getNodeHandler('channel_router' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'router-1',
        runId: 'run-router',
        pipelineId: 'p-router',
        orgId: 1,
        config: {
          primaryChannel: 'email_first',
          requireVerifiedEmail: true,
          requireMobileForVoice: true,
        },
        input: {},
        incoming: [
          {
            id: 'lead-email',
            collection: 'leads',
            data: { email: 'verified@apple.com', emailVerified: true },
            meta: {} as any,
          },
          {
            id: 'lead-voice',
            collection: 'leads',
            data: { email: 'unverified@test.com', emailVerified: false, phone: '+14155550199', phoneType: 'mobile' },
            meta: {} as any,
          },
          {
            id: 'lead-li',
            collection: 'leads',
            data: { email: '', phone: '', linkedinUrl: 'https://linkedin.com/in/exec' },
            meta: {} as any,
          },
          {
            id: 'lead-empty',
            collection: 'leads',
            data: { companyName: 'Unknown LLC' },
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

      expect(emittedByPort.main).toHaveLength(4)
      expect(emittedByPort.email).toHaveLength(1)
      expect(emittedByPort.email[0].id).toBe('lead-email')
      expect(emittedByPort.voice).toHaveLength(1)
      expect(emittedByPort.voice[0].id).toBe('lead-voice')
      expect(emittedByPort.linkedin).toHaveLength(1)
      expect(emittedByPort.linkedin[0].id).toBe('lead-li')
      expect(emittedByPort.fallback).toHaveLength(1)
      expect(emittedByPort.fallback[0].id).toBe('lead-empty')
    })
  })

  // ── 5. Webhook Dispatcher Node ───────────────────────────────────
  describe('WebhookDispatcherNode (HMAC Signature & Delivery)', () => {
    it('should compute valid HMAC SHA-256 signatures', () => {
      const payload = '{"test":true}'
      const secret = 'super_secret_key'
      const sig1 = computeHmacSignature(payload, secret)
      const sig2 = computeHmacSignature(payload, secret)

      expect(sig1).toHaveLength(64)
      expect(sig1).toBe(sig2)
    })

    it('should execute WebhookDispatcherNode and track delivery status', async () => {
      registerWebhookDispatcherNode()
      const handler = getNodeHandler('webhook_dispatcher' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'hook-1',
        runId: 'run-hook',
        pipelineId: 'p-hook',
        orgId: 1,
        config: {
          url: 'https://api.example.com/webhook',
          signingSecret: 'whsec_test12345',
          simulate: true,
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { email: 'client@company.com', companyName: 'Company Inc' },
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
      expect(data._webhookDelivered).toBe(true)
      expect(data._webhookStatus).toBe(200)
    })
  })

  // ── 6. Export Node ───────────────────────────────────────────────
  describe('ExportNode (CSV, JSON, NDJSON batch sink)', () => {
    it('should format records to CSV and NDJSON correctly', () => {
      const records = [
        { name: 'John Doe', company: 'Acme', email: 'john@acme.com' },
        { name: 'Jane Smith', company: 'Beta Corp', email: 'jane@beta.com' },
      ]

      const csv = recordsToCsv(records, ['name', 'company'])
      expect(csv).toContain('"name","company"')
      expect(csv).toContain('"John Doe","Acme"')

      const ndjson = recordsToNdjson(records)
      const lines = ndjson.split('\n')
      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0]).email).toBe('john@acme.com')
    })

    it('should execute ExportNode and produce data summary', async () => {
      registerExportNode()
      const handler = getNodeHandler('export' as any)
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'export-1',
        runId: 'run-export',
        pipelineId: 'p-export',
        orgId: 1,
        config: {
          format: 'csv',
          columns: 'firstName,companyName,email',
          fileNameTemplate: 'leads_clean_{{date}}',
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { firstName: 'Tim', companyName: 'Apple', email: 'tim@apple.com' },
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
      expect(emittedByPort.main[0].data._exported).toBe(true)

      expect(emittedByPort.summary).toHaveLength(1)
      const summary = emittedByPort.summary[0].data.exportSummary
      expect(summary.totalExported).toBe(1)
      expect(summary.format).toBe('csv')
      expect(summary.fileSizeBytes).toBeGreaterThan(0)
    })
  })

  // ── 7. Code Improvements & Enhancements Verification ──────────────
  describe('Engine Code Improvements', () => {
    it('should clean legal suffixes from company names', () => {
      expect(cleanCompanyName('Acme Technologies, Inc.')).toBe('Acme Technologies')
      expect(cleanCompanyName('Stripe, LLC')).toBe('Stripe')
      expect(cleanCompanyName('Klarna Holding AB (publ)')).toBe('Klarna Holding AB')
      expect(cleanCompanyName('Apple Inc (NASDAQ: AAPL)')).toBe('Apple')
      expect(cleanCompanyName('Siemens AG')).toBe('Siemens AG')
      expect(cleanCompanyName('Shopify Ltd.')).toBe('Shopify')
    })

    it('should split full names into first and last name', () => {
      expect(splitFullName('Dr. Emily Watson')).toEqual({ firstName: 'Emily', lastName: 'Watson' })
      expect(splitFullName('Martin Luther King, Jr.')).toEqual({ firstName: 'Martin', lastName: 'Luther King' })
      expect(splitFullName('Cher')).toEqual({ firstName: 'Cher', lastName: '' })
      expect(splitFullName('satya nadella')).toEqual({ firstName: 'Satya', lastName: 'Nadella' })
    })

    it('should route dropped records to discarded port in FilterNode', async () => {
      registerFilterNode()
      const handler = getNodeHandler('filter')
      expect(handler).toBeDefined()

      const emittedByPort: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'filt-1',
        runId: 'run-filt',
        pipelineId: 'p-filt',
        orgId: 1,
        config: {
          filter_mode: 'expression',
          condition: 'data.score > 50',
        },
        input: {},
        incoming: [
          { id: 'pass-rec', collection: 'leads', data: { score: 85 }, meta: {} as any },
          { id: 'drop-rec', collection: 'leads', data: { score: 20 }, meta: {} as any },
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
      expect(emittedByPort.main[0].id).toBe('pass-rec')
      expect(emittedByPort.discarded).toHaveLength(1)
      expect(emittedByPort.discarded[0].id).toBe('drop-rec')
    })

    it('should run CodeNode in generator/seed mode when incoming records are empty', async () => {
      registerCodeNode()
      const handler = getNodeHandler('code')
      expect(handler).toBeDefined()

      const emitted: any[] = []
      const mockCtx: NodeExecutionContext = {
        nodeId: 'code-gen',
        runId: 'run-code',
        pipelineId: 'p-code',
        orgId: 1,
        config: {
          code: 'return [{ lead: "Generated 1" }, { lead: "Generated 2" }];',
        },
        input: { city: 'Austin' },
        incoming: [], // Empty incoming — acting as generator
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => {
          emitted.push(...(Array.isArray(recs) ? recs : [recs]))
        },
        userRole: 'admin',
      }

      await handler!.execute(mockCtx)

      expect(emitted).toHaveLength(2)
      expect(emitted[0].data.lead).toBe('Generated 1')
      expect(emitted[1].data.lead).toBe('Generated 2')
    })
  })
})
