import { describe, it, expect, vi } from 'vitest'
import {
  N8nNodeAdapter,
  N8nHttpRequestNode,
  N8nSlackNode,
  type INodeType,
  type IExecuteFunctions,
  type INodeExecutionData,
} from '@sdk/core/engine/n8n-adapter'
import type { NodeExecutionContext } from '@sdk/core/engine/types'

describe('N8nNodeAdapter — n8n Node Runtime Compatibility', () => {
  it('should execute a custom INodeType and map input/output records cleanly', async () => {
    // 1. Define a mock n8n custom node
    const mockN8nNode: INodeType = {
      description: {
        displayName: 'Test Calculator Node',
        name: 'testCalculator',
        version: 1,
        description: 'Multiplies score by multiplier',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Multiplier',
            name: 'multiplier',
            type: 'number',
            default: 2,
          },
        ],
      },
      async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData()
        const multiplier = Number(this.getNodeParameter('multiplier', 0, 2))
        const returnData: INodeExecutionData[] = []

        for (const item of items) {
          const originalScore = Number(item.json.score || 10)
          returnData.push({
            json: {
              ...item.json,
              adjustedScore: originalScore * multiplier,
            },
          })
        }

        return [returnData]
      },
    }

    const adapter = new N8nNodeAdapter(mockN8nNode)
    expect(adapter.type).toBe('custom')

    // 2. Prepare execution context
    let emittedRecords: any[] = []
    const logs: string[] = []

    const mockCtx: NodeExecutionContext = {
      nodeId: 'node-n8n-1',
      runId: 'run-101',
      pipelineId: 'pipe-abc',
      orgId: 1,
      config: { multiplier: 5 },
      input: {},
      incoming: [
        {
          id: 'rec-1',
          collection: 'leads',
          data: { name: 'Alice Corp', score: 20 },
          meta: {} as any,
        },
        {
          id: 'rec-2',
          collection: 'leads',
          data: { name: 'Bob Inc', score: 15 },
          meta: {} as any,
        },
      ],
      log: (level, msg) => logs.push(`[${level}] ${msg}`),
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (recs) => {
        emittedRecords = Array.isArray(recs) ? recs : [recs]
      },
      userRole: 'admin',
    }

    // 3. Run execution
    await adapter.execute(mockCtx)

    // 4. Assert outputs
    expect(emittedRecords).toHaveLength(2)
    expect(emittedRecords[0].data.adjustedScore).toBe(100) // 20 * 5
    expect(emittedRecords[1].data.adjustedScore).toBe(75)  // 15 * 5
    expect(logs.some(l => l.includes('Executing n8n node'))).toBe(true)
  })

  it('should interpolate template expressions in getNodeParameter', async () => {
    const mockGreetingNode: INodeType = {
      description: {
        displayName: 'Greeting Node',
        name: 'greeting',
        version: 1,
        description: 'Formats greeting',
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      },
      async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const message = this.getNodeParameter('messageTemplate', 0) as string
        return [[{ json: { formattedMessage: message } }]]
      },
    }

    const adapter = new N8nNodeAdapter(mockGreetingNode)

    let emittedRecords: any[] = []
    const mockCtx: NodeExecutionContext = {
      nodeId: 'node-n8n-2',
      runId: 'run-102',
      pipelineId: 'pipe-abc',
      orgId: 1,
      config: {
        messageTemplate: 'Hello {{ lead.name }}, welcome to {{ lead.company }}!',
      },
      input: { name: 'Sarah Connor', company: 'Cyberdyne' },
      incoming: [
        {
          id: 'rec-1',
          collection: 'leads',
          data: { name: 'Sarah Connor', company: 'Cyberdyne' },
          meta: {} as any,
        },
      ],
      log: () => {},
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (recs) => {
        emittedRecords = Array.isArray(recs) ? recs : [recs]
      },
      userRole: 'member',
    }

    await adapter.execute(mockCtx)

    expect(emittedRecords).toHaveLength(1)
    expect(emittedRecords[0].data.formattedMessage).toBe('Hello Sarah Connor, welcome to Cyberdyne!')
  })

  it('should execute N8nSlackNode and simulate webhook call', async () => {
    const slackNode = new N8nSlackNode()
    const adapter = new N8nNodeAdapter(slackNode)

    // Mock global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
      text: async () => 'ok',
    } as any)

    let emitted: any[] = []
    const mockCtx: NodeExecutionContext = {
      nodeId: 'slack-1',
      runId: 'run-103',
      pipelineId: 'pipe-xyz',
      orgId: 1,
      config: {
        webhookUrl: 'https://hooks.slack.com/services/TEST/TOKEN',
        text: 'New lead arrived: Acme Corp',
      },
      input: {},
      incoming: [{ id: '1', collection: 'leads', data: { company: 'Acme Corp' }, meta: {} as any }],
      log: () => {},
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
      userRole: 'admin',
    }

    await adapter.execute(mockCtx)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/TEST/TOKEN',
      expect.objectContaining({
        method: 'POST',
      })
    )
    expect(emitted).toHaveLength(1)
    expect(emitted[0].data.sent).toBe(true)

    fetchSpy.mockRestore()
  })

  it('should honor continueOnFail option when execution throws', async () => {
    const failingNode: INodeType = {
      description: {
        displayName: 'Failing Node',
        name: 'failing',
        version: 1,
        description: 'Always fails',
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      },
      async execute() {
        throw new Error('Boom from n8n!')
      },
    }

    const adapter = new N8nNodeAdapter(failingNode, { continueOnFail: true })
    let emitted: any[] = []

    const mockCtx: NodeExecutionContext = {
      nodeId: 'fail-1',
      runId: 'run-104',
      pipelineId: 'pipe-fail',
      orgId: 1,
      config: {},
      input: {},
      incoming: [],
      log: () => {},
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
      userRole: 'admin',
    }

    await expect(adapter.execute(mockCtx)).resolves.toBeUndefined()
    expect(emitted).toEqual([])
  })
})
