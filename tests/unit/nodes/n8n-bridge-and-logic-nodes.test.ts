import { describe, it, expect, vi } from 'vitest'
import { registerN8nBridgeNode } from '@sdk/backend/nodes/n8n-bridge-node'
import { registerDedupeNode } from '@sdk/backend/nodes/dedupe-node'
import { registerFormatNode, cleanJobTitle, toTitleCase, normalizePhoneNumber, extractDomainFromUrl } from '@sdk/backend/nodes/format-node'
import { getNodeHandler } from '@sdk/backend/engine/registry'
import type { NodeExecutionContext } from '@sdk/backend/engine/types'

describe('N8n Bridge, Dedupe, and Format Nodes', () => {
  it('should clean and normalize lead data using FormatNode utilities', () => {
    // 1. Job title cleaner
    expect(cleanJobTitle("VP of Engineering (We're Hiring!)")).toBe('VP of Engineering')
    expect(cleanJobTitle('Head of Growth 🚀 [Hiring]')).toBe('Head of Growth')
    expect(cleanJobTitle('Chief Marketing Officer - Hiring Now')).toBe('Chief Marketing Officer')

    // 2. Name title caser
    expect(toTitleCase('JOHN DOE')).toBe('John Doe')
    expect(toTitleCase('sARAh cONNOr')).toBe('Sarah Connor')

    // 3. Phone normalizer
    expect(normalizePhoneNumber('+1 (555) 234-5678')).toBe('+15552345678')
    expect(normalizePhoneNumber('(020) 7946 0912')).toBe('02079460912')

    // 4. Domain extractor
    expect(extractDomainFromUrl('https://www.apple.com/iphone/')).toBe('apple.com')
    expect(extractDomainFromUrl('steve@pixar.com')).toBe('pixar.com')
  })

  it('should execute FormatNode and standardize all records', async () => {
    registerFormatNode()
    const handler = getNodeHandler('format' as any)
    expect(handler).toBeDefined()

    let emitted: any[] = []
    const mockCtx: NodeExecutionContext = {
      nodeId: 'format-1',
      runId: 'run-fmt',
      pipelineId: 'p-1',
      orgId: 1,
      config: {
        cleanJobTitles: true,
        titleCaseNames: true,
        normalizePhones: true,
        extractDomains: true,
      },
      input: {},
      incoming: [
        {
          id: 'rec-1',
          collection: 'leads',
          data: {
            fullName: 'ELON MUSK',
            title: 'CEO & Technoking (Hiring Engineers!)',
            phone: '+1 (800) 555-0199',
            website: 'https://www.x.com/about',
          },
          meta: {} as any,
        },
      ],
      log: () => {},
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
      userRole: 'admin',
    }

    await handler!.execute(mockCtx)

    expect(emitted).toHaveLength(1)
    const lead = emitted[0].data
    expect(lead.fullName).toBe('Elon Musk')
    expect(lead.title).toBe('CEO & Technoking')
    expect(lead.phone).toBe('+18005550199')
    expect(lead.domain).toBe('x.com')
  })

  it('should deduplicate records using DedupeNode with fuzzy matching and branching', async () => {
    registerDedupeNode()
    const handler = getNodeHandler('dedupe' as any)
    expect(handler).toBeDefined()

    const emittedByPort: Record<string, any[]> = {}
    const mockCtx: NodeExecutionContext = {
      nodeId: 'dedupe-1',
      runId: 'run-dedupe',
      pipelineId: 'p-1',
      orgId: 1,
      config: {
        field: 'website',
        fuzzy: true,
        action: 'branch',
      },
      input: {},
      incoming: [
        { id: '1', collection: 'leads', data: { company: 'Stripe Inc', website: 'https://stripe.com/' }, meta: {} as any },
        { id: '2', collection: 'leads', data: { company: 'Stripe', website: 'http://www.stripe.com' }, meta: {} as any }, // Duplicate!
        { id: '3', collection: 'leads', data: { company: 'Linear', website: 'https://linear.app' }, meta: {} as any },
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

    // Unique port should receive 2 records
    expect(emittedByPort.main).toHaveLength(2)
    expect(emittedByPort.main.map(r => r.data.company)).toEqual(['Stripe Inc', 'Linear'])

    // Duplicate port should receive 1 record
    expect(emittedByPort.duplicate).toHaveLength(1)
    expect(emittedByPort.duplicate[0].data.company).toBe('Stripe')
  })

  it('should call n8n webhook and merge response via N8nBridgeNode', async () => {
    registerN8nBridgeNode()
    const handler = getNodeHandler('n8n_bridge' as any)
    expect(handler).toBeDefined()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ verified: true, creditScore: 92 }),
    } as any)

    let emitted: any[] = []
    const mockCtx: NodeExecutionContext = {
      nodeId: 'n8n-bridge-1',
      runId: 'run-bridge',
      pipelineId: 'p-1',
      orgId: 1,
      config: {
        webhookUrl: 'https://my-n8n.internal/webhook/enrich-lead',
        method: 'POST',
        waitForResponse: true,
      },
      input: {},
      incoming: [
        { id: '1', collection: 'leads', data: { email: 'tim@apple.com' }, meta: {} as any },
      ],
      log: () => {},
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
      userRole: 'admin',
    }

    await handler!.execute(mockCtx)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://my-n8n.internal/webhook/enrich-lead',
      expect.objectContaining({
        method: 'POST',
      })
    )

    expect(emitted).toHaveLength(1)
    expect(emitted[0].data.email).toBe('tim@apple.com')
    expect(emitted[0].data.verified).toBe(true)
    expect(emitted[0].data.creditScore).toBe(92)

    fetchSpy.mockRestore()
  })
})
