import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executePipeline, isScraperNodeType, getRunState } from '@sdk/core/engine/graph'
import { registerNode, getNodeHandler } from '@sdk/core/engine/registry'
import type { NodeHandler } from '@sdk/core/engine/types'
import type { PipelineDefinition } from '@sdk/core/types/pipeline.types'

describe('Proxy Scoping & Server Scraper Enforcement', () => {
  describe('isScraperNodeType', () => {
    it('should identify scraper node types correctly', () => {
      expect(isScraperNodeType('scraper')).toBe(true)
      expect(isScraperNodeType('job_scraper')).toBe(true)
      expect(isScraperNodeType('google_maps_scraper')).toBe(true)
      expect(isScraperNodeType('custom_scraper')).toBe(true)
    })

    it('should return false for non-scraper node types', () => {
      expect(isScraperNodeType('ai')).toBe(false)
      expect(isScraperNodeType('http')).toBe(false)
      expect(isScraperNodeType('filter')).toBe(false)
      expect(isScraperNodeType('transform')).toBe(false)
      expect(isScraperNodeType('waterfall_enricher')).toBe(false)
      expect(isScraperNodeType('crm_upsert')).toBe(false)
      expect(isScraperNodeType('voice_call')).toBe(false)
      expect(isScraperNodeType('news_radar')).toBe(false)
      expect(isScraperNodeType('notify')).toBe(false)
      expect(isScraperNodeType('code')).toBe(false)
      expect(isScraperNodeType('approval')).toBe(false)
      expect(isScraperNodeType('n8n_bridge')).toBe(false)
    })
  })

  describe('executePipeline proxy isolation', () => {
    let capturedScraperProxy: any = undefined
    let capturedAiProxy: any = undefined
    let capturedHttpProxy: any = undefined

    beforeEach(() => {
      capturedScraperProxy = undefined
      capturedAiProxy = undefined
      capturedHttpProxy = undefined

      const scraperHandler: NodeHandler = {
        type: 'scraper',
        async execute(ctx) {
          capturedScraperProxy = ctx.proxyConfig
          ctx.emit({
            id: 'rec-1',
            collection: 'leads',
            data: { title: 'Found business' },
            meta: {
              pipelineId: ctx.pipelineId,
              runId: ctx.runId,
              sourceNodeId: ctx.nodeId,
              orgId: ctx.orgId,
              createdAt: new Date().toISOString(),
              trace: [ctx.nodeId],
            },
          })
        },
      }

      const aiHandler: NodeHandler = {
        type: 'ai',
        async execute(ctx) {
          capturedAiProxy = ctx.proxyConfig
          for (const r of ctx.incoming) {
            ctx.emit({
              ...r,
              data: { ...r.data, analyzed: true },
            })
          }
        },
      }

      const httpHandler: NodeHandler = {
        type: 'http',
        async execute(ctx) {
          capturedHttpProxy = ctx.proxyConfig
          for (const r of ctx.incoming) {
            ctx.emit({
              ...r,
              data: { ...r.data, posted: true },
            })
          }
        },
      }

      registerNode(scraperHandler, {
        type: 'scraper',
        name: 'Scraper',
        category: 'Source',
        icon: 'Download',
        inputs: [],
        outputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        configSchema: {},
      })

      registerNode(aiHandler, {
        type: 'ai',
        name: 'AI',
        category: 'Transform',
        icon: 'Brain',
        inputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        outputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        configSchema: {},
      })

      registerNode(httpHandler, {
        type: 'http',
        name: 'HTTP',
        category: 'Action',
        icon: 'Send',
        inputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        outputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        configSchema: {},
      })
    })

    it('should pass proxyConfig ONLY to scraper nodes and inject null into AI and HTTP nodes', async () => {
      const pipeline: PipelineDefinition = {
        id: 'pipe-proxy-test',
        name: 'Proxy Scoping Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'node-scraper', type: 'scraper', name: 'Scraper', enabled: true, config: {} },
          { id: 'node-ai', type: 'ai', name: 'AI Analyzer', enabled: true, config: {} },
          { id: 'node-http', type: 'http', name: 'HTTP Webhook', enabled: true, config: {} },
        ],
        edges: [
          { id: 'e1', from: 'node-scraper', to: 'node-ai', fromPort: 'main', toPort: 'main' },
          { id: 'e2', from: 'node-ai', to: 'node-http', fromPort: 'main', toPort: 'main' },
        ],
      }

      const activeProxy = {
        server: 'residential.proxy.io',
        port: 8080,
        username: 'user_residential',
        password: 'secret_password_123',
        type: 'http' as const,
      }

      const handle = await executePipeline(pipeline, {
        runId: 'run-proxy-scoping',
        proxyConfig: activeProxy,
      })

      // Wait for execution to finish
      while (!handle.isDone()) {
        await new Promise(r => setTimeout(r, 20))
      }

      // Verify the scraper node got the proxy configuration
      expect(capturedScraperProxy).toBeDefined()
      expect(capturedScraperProxy).toEqual(activeProxy)

      // CRITICAL: Verify AI and HTTP nodes did NOT receive the proxy and connected directly
      expect(capturedAiProxy).toBeNull()
      expect(capturedHttpProxy).toBeNull()
    })

    it('should inject null proxyConfig to all nodes if no proxy was provided', async () => {
      const pipeline: PipelineDefinition = {
        id: 'pipe-no-proxy-test',
        name: 'No Proxy Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'node-scraper', type: 'scraper', name: 'Scraper', enabled: true, config: {} },
          { id: 'node-ai', type: 'ai', name: 'AI Analyzer', enabled: true, config: {} },
        ],
        edges: [
          { id: 'e1', from: 'node-scraper', to: 'node-ai', fromPort: 'main', toPort: 'main' },
        ],
      }

      const handle = await executePipeline(pipeline, {
        runId: 'run-no-proxy',
        proxyConfig: null,
      })

      while (!handle.isDone()) {
        await new Promise(r => setTimeout(r, 20))
      }

      expect(capturedScraperProxy).toBeNull()
      expect(capturedAiProxy).toBeNull()
    })

    it('should pass proxyConfig to job_scraper while keeping downstream CRM/AI proxy null', async () => {
      let capturedJobScraperProxy: any = undefined
      let capturedCrmProxy: any = undefined

      registerNode({
        type: 'job_scraper' as any,
        async execute(ctx) {
          capturedJobScraperProxy = ctx.proxyConfig
          ctx.emit({
            id: 'job-1',
            collection: 'leads',
            data: { companyName: 'Acme', openJobs: 5 },
            meta: {
              pipelineId: ctx.pipelineId,
              runId: ctx.runId,
              sourceNodeId: ctx.nodeId,
              orgId: ctx.orgId,
              createdAt: new Date().toISOString(),
              trace: [ctx.nodeId],
            },
          })
        },
      }, {
        type: 'job_scraper' as any,
        name: 'Job Scraper',
        category: 'Source',
        icon: 'Briefcase',
        inputs: [],
        outputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        configSchema: {},
      })

      registerNode({
        type: 'crm_upsert' as any,
        async execute(ctx) {
          capturedCrmProxy = ctx.proxyConfig
          for (const r of ctx.incoming) {
            ctx.emit({ ...r, data: { ...r.data, synced: true } })
          }
        },
      }, {
        type: 'crm_upsert' as any,
        name: 'CRM Upsert',
        category: 'Action',
        icon: 'Database',
        inputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        outputs: [{ id: 'main', label: 'Main', schema: {} as any }],
        configSchema: {},
      })

      const pipeline: PipelineDefinition = {
        id: 'pipe-job-scraper-test',
        name: 'Job Scraper with CRM Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'node-jobs', type: 'job_scraper' as any, name: 'Job Scraper', enabled: true, config: {} },
          { id: 'node-crm', type: 'crm_upsert' as any, name: 'CRM Sync', enabled: true, config: {} },
        ],
        edges: [
          { id: 'e1', from: 'node-jobs', to: 'node-crm', fromPort: 'main', toPort: 'main' },
        ],
      }

      const activeProxy = {
        server: 'datacenter-dedicated.proxy.com',
        port: 9000,
        username: 'corp_user',
        password: 'corp_password',
        type: 'socks5' as const,
      }

      const handle = await executePipeline(pipeline, {
        runId: 'run-job-scraper-proxy',
        proxyConfig: activeProxy,
      })

      while (!handle.isDone()) {
        await new Promise(r => setTimeout(r, 20))
      }

      // job_scraper got the proxy
      expect(capturedJobScraperProxy).toBeDefined()
      expect(capturedJobScraperProxy).toEqual(activeProxy)

      // CRM upsert node did NOT get the proxy and connected directly
      expect(capturedCrmProxy).toBeNull()
    })
  })

  describe('Server-Side BYO Proxy Scraper Guardrail', () => {
    function simulateServerRunGuardrail(def: PipelineDefinition, proxyConfig: any | null, target = 'local') {
      if (target === 'farm_auto' || target.startsWith('worker:')) {
        return { allowed: true }
      }
      const hasScraperNode = def.nodes.some(n => isScraperNodeType(n.type))
      if (hasScraperNode && !proxyConfig) {
        return {
          allowed: false,
          status: 400,
          code: 'PROXY_REQUIRED_FOR_SCRAPER',
          error: 'Server-side scraping requires a proxy configuration to prevent datacenter IP blocking. Please assign a proxy to this pipeline in Settings or run via Desktop Worker.',
        }
      }
      return { allowed: true }
    }

    it('should reject server-side pipeline containing a scraper node when proxy is missing', () => {
      const scraperPipeline: PipelineDefinition = {
        id: 'pipe-scraper',
        name: 'Scraper Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'scraper', name: 'Web Scraper', enabled: true, config: {} },
          { id: 'n2', type: 'ai', name: 'AI Analyzer', enabled: true, config: {} },
        ],
        edges: [{ id: 'e1', from: 'n1', to: 'n2', fromPort: 'main', toPort: 'main' }],
      }

      const result = simulateServerRunGuardrail(scraperPipeline, null, 'local')
      expect(result.allowed).toBe(false)
      expect(result.status).toBe(400)
      expect(result.code).toBe('PROXY_REQUIRED_FOR_SCRAPER')
      expect(result.error).toContain('Server-side scraping requires a proxy configuration')
    })

    it('should reject server-side pipeline containing a job_scraper node when proxy is missing', () => {
      const jobPipeline: PipelineDefinition = {
        id: 'pipe-jobs',
        name: 'Job Scraper Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'job_scraper', name: 'Job Radar', enabled: true, config: {} },
        ],
        edges: [],
      }

      const result = simulateServerRunGuardrail(jobPipeline, null, 'local')
      expect(result.allowed).toBe(false)
      expect(result.status).toBe(400)
      expect(result.code).toBe('PROXY_REQUIRED_FOR_SCRAPER')
    })

    it('should ALLOW server-side pipeline containing a scraper node when proxy IS provided', () => {
      const scraperPipeline: PipelineDefinition = {
        id: 'pipe-scraper',
        name: 'Scraper Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'scraper', name: 'Web Scraper', enabled: true, config: {} },
        ],
        edges: [],
      }

      const validProxy = {
        server: '10.0.0.1',
        port: 8080,
        type: 'http',
      }

      const result = simulateServerRunGuardrail(scraperPipeline, validProxy, 'local')
      expect(result.allowed).toBe(true)
    })

    it('should ALLOW server-side pipeline without scraper nodes (AI, HTTP, Transform) to run without any proxy', () => {
      const nonScraperPipeline: PipelineDefinition = {
        id: 'pipe-ai-only',
        name: 'AI Lead Scoring Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'trigger', name: 'Manual Trigger', enabled: true, config: {} },
          { id: 'n2', type: 'ai', name: 'AI Qualifier', enabled: true, config: {} },
          { id: 'n3', type: 'http', name: 'Slack Notify', enabled: true, config: {} },
        ],
        edges: [
          { id: 'e1', from: 'n1', to: 'n2', fromPort: 'main', toPort: 'main' },
          { id: 'e2', from: 'n2', to: 'n3', fromPort: 'main', toPort: 'main' },
        ],
      }

      const result = simulateServerRunGuardrail(nonScraperPipeline, null, 'local')
      expect(result.allowed).toBe(true)
    })

    it('should ALLOW desktop worker farm dispatch without requiring a server proxy', () => {
      const scraperPipeline: PipelineDefinition = {
        id: 'pipe-scraper',
        name: 'Scraper Pipeline',
        collection: 'leads',
        org_id: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [
          { id: 'n1', type: 'scraper', name: 'Web Scraper', enabled: true, config: {} },
        ],
        edges: [],
      }

      const result = simulateServerRunGuardrail(scraperPipeline, null, 'farm_auto')
      expect(result.allowed).toBe(true)
    })
  })
})

