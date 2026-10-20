import { describe, it, expect, vi } from 'vitest'
import {
  N8nNodeAdapter,
  N8nHttpRequestNode,
  N8nSlackNode,
  N8nDiscordNode,
  N8nHubSpotNode,
  N8nAirtableNode,
  N8nNotionNode,
  N8nOpenAiNode,
  N8nSendGridNode,
  N8nCodeNode,
  builtinN8nNodes,
  getBuiltinN8nNode,
  registerBuiltinN8nNode,
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

  describe('N8nDiscordNode', () => {
    it('should format embed and dispatch to Discord webhook', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'discord-msg-1' }),
        text: async () => 'ok',
      } as any)

      const node = new N8nDiscordNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'discord-1',
        runId: 'run-discord',
        pipelineId: 'pipe-discord',
        orgId: 1,
        config: {
          webhookUrl: 'https://discord.com/api/webhooks/123/token',
          content: 'Hello channel!',
          embedTitle: 'Hot Lead',
          embedDescription: 'Score 95',
          embedColor: 16711680,
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: { lead: 'test' }, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/token',
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.sent).toBe(true)
      expect(emitted[0].data.title).toBe('Hot Lead')

      fetchSpy.mockRestore()
    })
  })

  describe('N8nHubSpotNode', () => {
    it('should simulate contact creation when no API key is provided', async () => {
      const node = new N8nHubSpotNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'hs-1',
        runId: 'run-hs',
        pipelineId: 'pipe-hs',
        orgId: 1,
        config: {
          email: 'founder@startup.io',
          firstname: 'Alex',
          lastname: 'Vance',
          company: 'Black Mesa',
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: {}, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.simulated).toBe(true)
      expect(emitted[0].data.properties.email).toBe('founder@startup.io')
      expect(emitted[0].data.hubspotId).toMatch(/^hs_/)
    })

    it('should call HubSpot API when API key is provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'hs_real_999', properties: { email: 'alex@mesa.com' } }),
        text: async () => 'ok',
      } as any)

      const node = new N8nHubSpotNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'hs-2',
        runId: 'run-hs-2',
        pipelineId: 'pipe-hs',
        orgId: 1,
        config: {
          apiKey: 'pat-na1-secret-token',
          email: 'alex@mesa.com',
          firstname: 'Alex',
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: {}, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer pat-na1-secret-token',
          }),
        })
      )
      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.id).toBe('hs_real_999')

      fetchSpy.mockRestore()
    })
  })

  describe('N8nAirtableNode', () => {
    it('should simulate Airtable record creation when apiKey is omitted', async () => {
      const node = new N8nAirtableNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'at-1',
        runId: 'run-at',
        pipelineId: 'pipe-at',
        orgId: 1,
        config: {
          baseId: 'app12345',
          table: 'Leads',
          fields: { Name: 'Jane Doe', Company: 'Acme' },
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: {}, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.simulated).toBe(true)
      expect(emitted[0].data.table).toBe('Leads')
      expect(emitted[0].data.fields.Name).toBe('Jane Doe')
    })
  })

  describe('N8nNotionNode', () => {
    it('should simulate Notion page creation when apiKey is omitted', async () => {
      const node = new N8nNotionNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'notion-1',
        runId: 'run-notion',
        pipelineId: 'pipe-notion',
        orgId: 1,
        config: {
          databaseId: 'db-notion-xyz',
          title: 'Qualified Enterprise Lead',
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: {}, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.simulated).toBe(true)
      expect(emitted[0].data.title).toBe('Qualified Enterprise Lead')
    })
  })

  describe('N8nOpenAiNode', () => {
    it('should provide simulated completion when apiKey is omitted', async () => {
      const node = new N8nOpenAiNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'ai-1',
        runId: 'run-ai',
        pipelineId: 'pipe-ai',
        orgId: 1,
        config: {
          model: 'gpt-4o-mini',
          prompt: 'Write a cold pitch for SaaS CTOs',
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: { name: 'Acme' }, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.aiResponse).toContain('[AI Simulation: Response for prompt "Write a cold pitch for SaaS CT...')
      expect(emitted[0].data.name).toBe('Acme')
    })
  })

  describe('N8nSendGridNode', () => {
    it('should execute sendgrid node and record delivery metadata', async () => {
      const node = new N8nSendGridNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'sg-1',
        runId: 'run-sg',
        pipelineId: 'pipe-sg',
        orgId: 1,
        config: {
          to: 'client@prospect.com',
          from: 'sales@apex.io',
          subject: 'Special Offer',
          text: 'Check out our latest solutions.',
        },
        input: {},
        incoming: [{ id: '1', collection: 'leads', data: {}, meta: {} as any }],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(emitted).toHaveLength(1)
      expect(emitted[0].data.sent).toBe(true)
      expect(emitted[0].data.to).toBe('client@prospect.com')
      expect(emitted[0].data.subject).toBe('Special Offer')
    })
  })

  describe('N8nCodeNode', () => {
    it('should execute custom JS code sandbox using $input.all()', async () => {
      const node = new N8nCodeNode()
      const adapter = new N8nNodeAdapter(node)
      let emitted: any[] = []

      await adapter.execute({
        nodeId: 'code-1',
        runId: 'run-code',
        pipelineId: 'pipe-code',
        orgId: 1,
        config: {
          jsCode: `
            const items = $input.all();
            return items.map(item => ({
              json: {
                ...item.json,
                transformed: true,
                scoreDouble: item.json.score * 2
              }
            }));
          `,
        },
        input: {},
        incoming: [
          { id: '1', collection: 'leads', data: { name: 'Item 1', score: 10 }, meta: {} as any },
          { id: '2', collection: 'leads', data: { name: 'Item 2', score: 25 }, meta: {} as any },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (recs) => { emitted = Array.isArray(recs) ? recs : [recs] },
        userRole: 'admin',
      })

      expect(emitted).toHaveLength(2)
      expect(emitted[0].data.transformed).toBe(true)
      expect(emitted[0].data.scoreDouble).toBe(20)
      expect(emitted[1].data.scoreDouble).toBe(50)
    })
  })

  describe('Built-in Catalog & Registry Helpers', () => {
    it('should find built-in nodes via getBuiltinN8nNode', () => {
      expect(getBuiltinN8nNode('n8n-nodes-base.httpRequest')).toBeInstanceOf(N8nHttpRequestNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.slack')).toBeInstanceOf(N8nSlackNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.discord')).toBeInstanceOf(N8nDiscordNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.hubspot')).toBeInstanceOf(N8nHubSpotNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.airtable')).toBeInstanceOf(N8nAirtableNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.notion')).toBeInstanceOf(N8nNotionNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.openAi')).toBeInstanceOf(N8nOpenAiNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.sendGrid')).toBeInstanceOf(N8nSendGridNode)
      expect(getBuiltinN8nNode('n8n-nodes-base.code')).toBeInstanceOf(N8nCodeNode)
      expect(getBuiltinN8nNode('non-existent')).toBeUndefined()
    })

    it('should allow dynamic registration via registerBuiltinN8nNode', () => {
      class MockCustomN8nNode implements INodeType {
        description = {
          displayName: 'Custom Dyn Node',
          name: 'custom-dyn',
          version: 1,
          description: 'Dynamic test node',
          inputs: ['main'],
          outputs: ['main'],
          properties: [],
        }
        async execute() {
          return [[{ json: { custom: true } }]]
        }
      }

      registerBuiltinN8nNode('n8n-nodes-base.customDyn', () => new MockCustomN8nNode())
      const instance = getBuiltinN8nNode('n8n-nodes-base.customDyn')
      expect(instance).toBeDefined()
      expect(instance?.description.name).toBe('custom-dyn')
    })
  })
})
