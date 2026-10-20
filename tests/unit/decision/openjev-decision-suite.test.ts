// tests/unit/decision/openjev-decision-suite.test.ts
// Exhaustive test suite for OpenJev System-One Decision Engine, Model Catalog,
// Local HuggingFace Downloader, Multi-mode execution (Local ONNX, Local GGUF, LAN, API),
// 4-Tier Decision Cascade Funnel, and DAG Pipeline Nodes.

import { describe, it, expect, beforeEach } from 'bun:test'
import {
  DECISION_MODEL_CATALOG,
  getDecisionModel,
  getModelsByMode,
  getModelsByMaxRam,
  getDownloadableModels,
  ModelDownloadManager,
  SystemOneEngine,
  DecisionCascadeEngine,
} from '@sdk/core/decision'
import type {
  SystemOneQuestion,
  CascadePolicy,
} from '@sdk/core/decision'
import { getNodeHandler, getNodeTypeDescriptor } from '../../../sdk/backend/engine/registry'
import { registerBuiltInNodes } from '../../../sdk/backend/nodes'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

describe('OpenJev System-One Decision Suite', () => {
  beforeEach(() => {
    registerBuiltInNodes()
  })

  // ── 1. Model Catalog & Registry Tests ──────────────────────────────
  describe('Decision Model Catalog & HuggingFace Registry', () => {
    it('should expose at least 16 vetted decision models across all tiers and families', () => {
      expect(DECISION_MODEL_CATALOG.length).toBeGreaterThanOrEqual(16)
    })

    it('should have valid manifests with positive sizes and RAM estimates', () => {
      for (const model of DECISION_MODEL_CATALOG) {
        expect(model.id).toBeTruthy()
        expect(model.name).toBeTruthy()
        expect(model.family).toBeTruthy()
        expect(model.supportedModes.length).toBeGreaterThan(0)
        expect(model.supportedPrimitives.length).toBeGreaterThan(0)
        expect(model.defaultThreshold).toBeGreaterThan(0)
        expect(model.defaultThreshold).toBeLessThanOrEqual(1)
        expect(model.typicalLatencyMs).toBeGreaterThan(0)

        if (model.family !== 'cloud_api') {
          expect(model.sizeBytes).toBeGreaterThan(0)
          expect(model.ramEstimateBytes).toBeGreaterThan(0)
        }
      }
    })

    it('should retrieve model by exact ID', () => {
      const deberta = getDecisionModel('Xenova/nli-deberta-v3-small')
      expect(deberta).toBeDefined()
      expect(deberta?.family).toBe('nli_classifier')
      expect(deberta?.tier).toBe(1)
      expect(deberta?.supportedPrimitives).toContain('choice')
      expect(deberta?.supportedPrimitives).toContain('noul')

      const smollm = getDecisionModel('HuggingFaceTB/SmolLM2-135M-Instruct')
      expect(smollm).toBeDefined()
      expect(smollm?.family).toBe('slm_generative')
      expect(smollm?.recommendedQuant).toBe('Q4_K_M_GGUF')

      const openjev = getDecisionModel('GPT-AGI/OpenJev-1.5B')
      expect(openjev).toBeDefined()
      expect(openjev?.family).toBe('openjev')
    })

    it('should filter models by execution mode', () => {
      const localOnnxModels = getModelsByMode('local_onnx')
      expect(localOnnxModels.length).toBeGreaterThan(0)
      for (const m of localOnnxModels) {
        expect(m.supportedModes).toContain('local_onnx')
      }

      const lanModels = getModelsByMode('lan')
      expect(lanModels.length).toBeGreaterThan(0)
      for (const m of lanModels) {
        expect(m.supportedModes).toContain('lan')
      }

      const apiModels = getModelsByMode('api')
      expect(apiModels.length).toBeGreaterThan(0)
      for (const m of apiModels) {
        expect(m.supportedModes).toContain('api')
      }
    })

    it('should filter models by maximum RAM constraint (for small machines)', () => {
      // Small machine with max 150MB RAM limit for decision model
      const lowRamModels = getModelsByMaxRam(150)
      expect(lowRamModels.length).toBeGreaterThan(0)
      for (const m of lowRamModels) {
        expect(m.ramEstimateBytes).toBeLessThanOrEqual(150 * 1024 * 1024)
      }
      expect(lowRamModels.some((m) => m.id === 'Xenova/nli-deberta-v3-small')).toBe(true)
      expect(lowRamModels.some((m) => m.id === 'Xenova/mobilebert-uncased-mnli')).toBe(true)
    })

    it('should identify all downloadable models with valid Hugging Face download URLs', () => {
      const downloadable = getDownloadableModels()
      expect(downloadable.length).toBeGreaterThan(0)
      for (const m of downloadable) {
        expect(m.downloadUrl).toBeTruthy()
        expect(m.downloadUrl?.startsWith('https://huggingface.co/')).toBe(true)
        expect(m.downloadFile).toBeTruthy()
      }
    })
  })

  // ── 2. Model Downloader & Local Storage Tests ───────────────────────
  describe('Model Download Manager', () => {
    let downloader: ModelDownloadManager

    beforeEach(() => {
      downloader = new ModelDownloadManager()
    })

    it('should compute safe local directory paths for model identifiers', () => {
      const dir = downloader.getModelDir('Xenova/nli-deberta-v3-small')
      expect(dir).toContain('Xenova_nli-deberta-v3-small')

      const filePath = downloader.getModelFilePath('Xenova/nli-deberta-v3-small')
      expect(filePath).toContain('model_quantized.onnx')
    })

    it('should return null progress for uninstalled models', () => {
      const progress = downloader.getProgress('non-existent-model')
      expect(progress).toBeNull()
    })

    it('should safely handle cancellation for inactive downloads', () => {
      const cancelled = downloader.cancelDownload('Xenova/nli-deberta-v3-small')
      expect(cancelled).toBe(false)
    })

    it('should reject downloads for models lacking downloadUrl', async () => {
      expect(downloader.downloadModel('typesafe/jev-latest')).rejects.toThrow()
    })
  })

  // ── 3. SystemOneEngine Multi-Mode Inference Tests ───────────────────
  describe('SystemOneEngine (Primitives & Multi-Mode)', () => {
    let engine: SystemOneEngine

    beforeEach(() => {
      engine = new SystemOneEngine()
    })

    it('should evaluate Noul primitive with calibrated probabilities and thresholds', async () => {
      const state = {
        name: 'Sarah Chen',
        title: 'VP of Engineering',
        company: 'Stripe',
        bio: 'Oversees global payment infrastructure and developer platform architecture at Stripe.',
      }

      const questions: Record<string, SystemOneQuestion> = {
        is_decision_maker: {
          type: 'noul',
          instructions: 'This contact is a corporate executive, founder, or key decision maker in technology.',
          threshold: 0.70,
        },
      }

      const response = await engine.execute(state, questions, { mode: 'local_onnx' })
      expect(response.mode).toBe('local_onnx')
      expect(response.latencyMs).toBeGreaterThanOrEqual(0)
      expect(response.decisions.is_decision_maker).toBeDefined()
      expect(response.decisions.is_decision_maker.type).toBe('noul')

      const noul = response.decisions.is_decision_maker as any
      expect(typeof noul.value).toBe('boolean')
      expect(noul.probability).toBeGreaterThan(0)
      expect(noul.probability).toBeLessThanOrEqual(1)
      expect(noul.confidence).toBeGreaterThan(0)
      expect(response.isApproved).toBe(true)
    })

    it('should evaluate Choice primitive with complete softmax distribution summing to 1.0', async () => {
      const state = {
        company: 'Shopify Storefront',
        description: 'Direct-to-consumer athletic apparel and footwear e-commerce retailer.',
      }

      const questions: Record<string, SystemOneQuestion> = {
        industry: {
          type: 'choice',
          instructions: 'Determine the primary business model of this company.',
          choices: ['E-commerce & Retail', 'Enterprise SaaS', 'Biotech & Healthcare', 'Legal & Accounting'],
          threshold: 0.40,
        },
      }

      const response = await engine.execute(state, questions, { mode: 'local_onnx' })
      const choice = response.decisions.industry as any
      expect(choice).toBeDefined()
      expect(choice.type).toBe('choice')
      expect(choice.selected).toBe('E-commerce & Retail')
      expect(choice.confidence).toBeGreaterThan(0.40)

      // Verify probability distribution sums to approximately 1.0
      const totalProb = Object.values(choice.probabilities as Record<string, number>).reduce((a, b) => a + b, 0)
      expect(totalProb).toBeGreaterThanOrEqual(0.99)
      expect(totalProb).toBeLessThanOrEqual(1.01)
    })

    it('should evaluate Score primitive with continuous alignment and rubric levels', async () => {
      const state = {
        company: 'Datadog',
        funding: 'Public (NASDAQ: DDOG)',
        employees: 5000,
        tech: ['Kubernetes', 'AWS', 'Go', 'React'],
      }

      const questions: Record<string, SystemOneQuestion> = {
        lead_priority: {
          type: 'score',
          instructions: 'Rate the technical maturity and enterprise scale of this account.',
          scale: [1, 10],
          levels: ['starter', 'mid-market', 'enterprise'],
          threshold: 5,
        },
      }

      const response = await engine.execute(state, questions, { mode: 'local_onnx' })
      const scoreRes = response.decisions.lead_priority as any
      expect(scoreRes).toBeDefined()
      expect(scoreRes.type).toBe('score')
      expect(scoreRes.score).toBeGreaterThanOrEqual(1)
      expect(scoreRes.score).toBeLessThanOrEqual(10)
      expect(scoreRes.level).toBeDefined()
    })

    it('should handle simulated LAN server execution', async () => {
      const state = { company: 'Vercel', product: 'Frontend Cloud' }
      const questions: Record<string, SystemOneQuestion> = {
        is_cloud: { type: 'noul', instructions: 'Company operates in cloud infrastructure' },
      }

      // If mock LAN server is unreachable, should throw connection error cleanly
      expect(
        engine.execute(state, questions, {
          mode: 'lan',
          lanEndpoint: 'http://127.0.0.1:9999/v1/decision',
          timeoutMs: 300,
        })
      ).rejects.toThrow()
    })
  })

  // ── 4. 4-Tier Decision Cascade Funnel Tests ─────────────────────────
  describe('Decision Cascade Engine (4-Tier Funnel)', () => {
    let cascade: DecisionCascadeEngine

    beforeEach(() => {
      cascade = new DecisionCascadeEngine()
      cascade.resetTelemetry()
    })

    it('should short-circuit at Tier 0 (<1ms) when consumer email rule triggers reject', async () => {
      const lead = {
        name: 'John Doe',
        email: 'johndoe1985@gmail.com',
        company: 'Freelance',
      }

      const policy: CascadePolicy = {
        tier0Rules: [
          { field: 'email', operator: 'contains', value: '@gmail.com', outcome: 'reject', reason: 'Consumer email' },
        ],
        questions: {
          is_b2b: { type: 'noul', instructions: 'Is B2B' },
        },
      }

      const response = await cascade.evaluate(lead, policy)
      expect(response.tierResolved).toBe(0)
      expect(response.isApproved).toBe(false)
      expect(response.latencyMs).toBeLessThanOrEqual(10)

      const telemetry = cascade.getTelemetry()
      expect(telemetry.tier0Resolved).toBe(1)
      expect(telemetry.tier1Resolved).toBe(0)
      expect(telemetry.estimatedCostSavingsUsd).toBeGreaterThan(0)
    })

    it('should resolve at Tier 1 (NLI) for clear corporate B2B executive leads', async () => {
      const lead = {
        name: 'Michael Vance',
        email: 'mvance@snowflake.com',
        title: 'Chief Technology Officer',
        company: 'Snowflake Inc',
        description: 'Cloud Data Warehouse and AI Data Cloud Platform.',
      }

      const policy: CascadePolicy = {
        tier0Rules: [
          { field: 'email', operator: 'contains', value: '@gmail.com', outcome: 'reject' },
        ],
        tier1ModelId: 'Xenova/nli-deberta-v3-small',
        tier1HighThreshold: 0.80,
        tier1LowThreshold: 0.25,
        questions: {
          is_c_level: {
            type: 'noul',
            instructions: 'Contact holds an executive C-level or Chief Technology role.',
            threshold: 0.70,
          },
        },
      }

      const response = await cascade.evaluate(lead, policy)
      expect(response.tierResolved).toBe(1)
      expect(response.isApproved).toBe(true)

      const telemetry = cascade.getTelemetry()
      expect(telemetry.tier1Resolved).toBe(1)
      expect(telemetry.totalEvaluated).toBe(1)
    })

    it('should escalate to Tier 2 when Tier 1 confidence is ambiguous', async () => {
      const lead = {
        name: 'Alex Grey',
        email: 'alex@consulting-corp.com',
        title: 'Associate Consultant',
        company: 'Strategic Advisors',
      }

      const policy: CascadePolicy = {
        tier1ModelId: 'Xenova/nli-deberta-v3-small',
        // Artificially high thresholds to force escalation to Tier 2
        tier1HighThreshold: 0.99,
        tier1LowThreshold: 0.01,
        tier2HighThreshold: 0.50,
        tier2LowThreshold: 0.20,
        questions: {
          is_decision_maker: {
            type: 'noul',
            instructions: 'Has direct purchasing approval for software',
          },
        },
      }

      const response = await cascade.evaluate(lead, policy)
      expect(response.tierResolved).toBe(2)

      const telemetry = cascade.getTelemetry()
      expect(telemetry.tier2Resolved).toBe(1)
    })
  })

  // ── 5. Pipeline DAG Node Integration Tests ──────────────────────────
  describe('Pipeline DAG Nodes: SystemOneDecisionNode & DecisionCascadeNode', () => {
    it('should have registered system_one_decision and decision_cascade node handlers', () => {
      const s1Handler = getNodeHandler('system_one_decision' as any)
      expect(s1Handler).toBeDefined()

      const s1Descriptor = getNodeTypeDescriptor('system_one_decision' as any)
      expect(s1Descriptor).toBeDefined()
      expect(s1Descriptor?.outputs.some((o) => o.id === 'approved')).toBe(true)
      expect(s1Descriptor?.outputs.some((o) => o.id === 'rejected')).toBe(true)
      expect(s1Descriptor?.outputs.some((o) => o.id === 'uncertain')).toBe(true)

      const cascadeHandler = getNodeHandler('decision_cascade' as any)
      expect(cascadeHandler).toBeDefined()

      const cascadeDescriptor = getNodeTypeDescriptor('decision_cascade' as any)
      expect(cascadeDescriptor).toBeDefined()
      expect(cascadeDescriptor?.outputs.some((o) => o.id === 'telemetry')).toBe(true)
    })

    it('should execute SystemOneDecisionNode and emit to approved and main ports', async () => {
      const handler = getNodeHandler('system_one_decision' as any)!

      const emitted: Record<string, PipelineRecord[]> = {}
      const testRecords: PipelineRecord[] = [
        {
          id: 'rec-1',
          collection: 'leads',
          data: {
            companyName: 'Acme Cloud Solutions',
            industry: 'Enterprise Software & SaaS',
            contactName: 'Jennifer Lopez',
            jobTitle: 'Founder & CEO',
          },
          meta: {
            pipelineId: 'pipe-1',
            runId: 'run-1',
            sourceNodeId: 'src-1',
            orgId: 1,
            createdAt: new Date().toISOString(),
            trace: [],
          },
        },
      ]

      await handler.execute({
        nodeId: 's1-node-1',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        orgId: 1,
        userRole: 'admin',
        proxyConfig: null,
        incoming: testRecords,
        config: {
          mode: 'local_onnx',
          modelId: 'Xenova/nli-deberta-v3-small',
          decisionFieldPrefix: 'test_dec_',
          questions: {
            is_founder: {
              type: 'noul',
              instructions: 'The contact is a company Founder, Co-Founder, or CEO.',
              threshold: 0.65,
            },
          },
        },
        emit: (records, port) => {
          emitted[port] = records
        },
        log: () => {},
        progress: () => {},
      })

      expect(emitted['main']).toBeDefined()
      expect(emitted['main'].length).toBe(1)
      expect(emitted['approved']).toBeDefined()
      expect(emitted['approved'].length).toBe(1)

      const enriched = emitted['approved'][0].data
      expect(enriched.test_dec_model).toBe('Xenova/nli-deberta-v3-small')
      expect(enriched.test_dec_mode).toBe('local_onnx')
      expect(enriched.test_dec_is_founder).toBe(true)
      expect(enriched.test_dec_is_founder_prob).toBeGreaterThan(0.65)
    })

    it('should execute DecisionCascadeNode and emit both classified leads and telemetry metrics', async () => {
      const handler = getNodeHandler('decision_cascade' as any)!

      const emitted: Record<string, PipelineRecord[]> = {}
      const testRecords: PipelineRecord[] = [
        // Lead 1: Consumer email -> Tier 0 Reject
        {
          id: 'rec-consumer',
          collection: 'leads',
          data: {
            companyName: 'Small Bakery',
            email: 'baker123@yahoo.com',
          },
          meta: {
            pipelineId: 'pipe-1',
            runId: 'run-1',
            sourceNodeId: 'src-1',
            orgId: 1,
            createdAt: new Date().toISOString(),
            trace: [],
          },
        },
        // Lead 2: Corporate B2B executive -> Tier 1 Approve
        {
          id: 'rec-b2b',
          collection: 'leads',
          data: {
            companyName: 'Apex Data Corp',
            email: 'admin@apexdata.io',
            title: 'Chief Information Officer',
            description: 'Enterprise data analytics infrastructure',
          },
          meta: {
            pipelineId: 'pipe-1',
            runId: 'run-1',
            sourceNodeId: 'src-1',
            orgId: 1,
            createdAt: new Date().toISOString(),
            trace: [],
          },
        },
      ]

      await handler.execute({
        nodeId: 'cascade-node-1',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        orgId: 1,
        userRole: 'admin',
        proxyConfig: null,
        incoming: testRecords,
        config: {
          tier0Rules: [
            { field: 'email', operator: 'contains', value: '@yahoo.com', outcome: 'reject' },
          ],
          tier1HighThreshold: 0.70,
          tier1LowThreshold: 0.25,
          decisionFieldPrefix: 'cas_',
          questions: {
            is_cio: {
              type: 'noul',
              instructions: 'Holds a Chief Information Officer or Executive IT role.',
              threshold: 0.65,
            },
          },
        },
        emit: (records, port) => {
          emitted[port] = records
        },
        log: () => {},
        progress: () => {},
      })

      expect(emitted['main'].length).toBe(2)
      expect(emitted['rejected'].length).toBe(1)
      expect(emitted['rejected'][0].id).toBe('rec-consumer')
      expect(emitted['rejected'][0].data.cas_tier_resolved).toBe(0)

      expect(emitted['approved'].length).toBe(1)
      expect(emitted['approved'][0].id).toBe('rec-b2b')
      expect(emitted['approved'][0].data.cas_tier_resolved).toBe(1)

      // Verify telemetry summary emission
      expect(emitted['telemetry']).toBeDefined()
      expect(emitted['telemetry'].length).toBe(1)
      const telData = emitted['telemetry'][0].data
      expect(telData.type).toBe('decision_cascade_telemetry')
      expect(telData.totalEvaluated).toBe(2)
      expect(telData.tier0Resolved).toBe(1)
      expect(telData.tier1Resolved).toBe(1)
      expect(telData.estimatedCostSavingsUsd).toBeGreaterThan(0)
    })
  })
})
