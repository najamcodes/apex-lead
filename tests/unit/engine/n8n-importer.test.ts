import { describe, it, expect } from 'vitest'
import {
  importN8nWorkflow,
  translateN8nExpressions,
  mapN8nNodeType,
  type N8nWorkflowJson,
} from '@sdk/core/engine/n8n-importer'

describe('N8nWorkflowImporter — Workflow JSON Migration & Translation', () => {
  it('should translate n8n expressions to Lead Gen Desk template syntax', () => {
    expect(translateN8nExpressions('={{ $json.email }}')).toBe('{{ input.email }}')
    expect(translateN8nExpressions('={{ $json["company"]["name"] }}')).toBe('{{ input.company.name }}')
    expect(translateN8nExpressions('https://api.example.com/leads/{{ $json.id }}')).toBe('https://api.example.com/leads/{{ input.id }}')
    expect(translateN8nExpressions({ url: '={{ $json.site }}', headers: { auth: 'Bearer secret' } })).toEqual({
      url: '{{ input.site }}',
      headers: { auth: 'Bearer secret' },
    })
  })

  it('should map standard n8n node types to native platform node types', () => {
    expect(mapN8nNodeType('n8n-nodes-base.httpRequest')).toBe('http')
    expect(mapN8nNodeType('n8n-nodes-base.if')).toBe('branch')
    expect(mapN8nNodeType('n8n-nodes-base.filter')).toBe('filter')
    expect(mapN8nNodeType('n8n-nodes-base.code')).toBe('code')
    expect(mapN8nNodeType('n8n-nodes-base.slack')).toBe('notify')
    expect(mapN8nNodeType('n8n-nodes-base.openAi')).toBe('ai')
    expect(mapN8nNodeType('n8n-nodes-base.customCommunityNode')).toBe('custom')
  })

  it('should convert a full multi-node n8n workflow into a valid DAG pipeline', () => {
    const sampleN8nWorkflow: N8nWorkflowJson = {
      name: 'B2B Lead Enrichment Workflow',
      nodes: [
        {
          id: 'node-start',
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          position: [100, 200],
          parameters: {},
        },
        {
          id: 'node-fetch',
          name: 'Fetch Company Leads',
          type: 'n8n-nodes-base.httpRequest',
          position: [300, 200],
          parameters: {
            url: 'https://api.hunter.io/v2/domain-search',
            method: 'GET',
            qs: { domain: '={{ $json.domain }}' },
          },
        },
        {
          id: 'node-filter',
          name: 'Filter High Score',
          type: 'n8n-nodes-base.if',
          position: [500, 200],
          parameters: {
            conditions: {
              number: [{ value1: '={{ $json.confidence }}', operation: 'largerEqual', value2: 80 }],
            },
          },
        },
        {
          id: 'node-slack',
          name: 'Notify Slack',
          type: 'n8n-nodes-base.slack',
          position: [700, 150],
          parameters: {
            text: 'Verified high-tier lead found: {{ $json.email }}',
          },
        },
      ],
      connections: {
        'Manual Trigger': {
          main: [
            [{ node: 'Fetch Company Leads', type: 'main', index: 0 }],
          ],
        },
        'Fetch Company Leads': {
          main: [
            [{ node: 'Filter High Score', type: 'main', index: 0 }],
          ],
        },
        'Filter High Score': {
          main: [
            // Branch 0 (True)
            [{ node: 'Notify Slack', type: 'main', index: 0 }],
          ],
        },
      },
    }

    const converted = importN8nWorkflow(sampleN8nWorkflow, 'test-pipeline-1')

    expect(converted.name).toBe('B2B Lead Enrichment Workflow')
    expect(converted.nodes).toHaveLength(4)
    expect(converted.edges).toHaveLength(3)
    expect(converted.isValidDag).toBe(true)

    // Check node type mappings
    const fetchNode = converted.nodes.find(n => n.id === 'node-fetch')
    expect(fetchNode?.type).toBe('http')
    expect(fetchNode?.config.qs).toEqual({ domain: '{{ input.domain }}' })

    const filterNode = converted.nodes.find(n => n.id === 'node-filter')
    expect(filterNode?.type).toBe('branch')

    // Check edge routing
    const slackEdge = converted.edges.find(e => e.to === 'node-slack')
    expect(slackEdge?.from).toBe('node-filter')
  })

  it('should detect cycles and set isValidDag to false for cyclical workflows', () => {
    const cyclicalWorkflow: N8nWorkflowJson = {
      name: 'Cyclical Loop',
      nodes: [
        { id: 'A', name: 'Node A', type: 'n8n-nodes-base.code' },
        { id: 'B', name: 'Node B', type: 'n8n-nodes-base.code' },
      ],
      connections: {
        'Node A': { main: [[{ node: 'Node B', type: 'main', index: 0 }]] },
        'Node B': { main: [[{ node: 'Node A', type: 'main', index: 0 }]] },
      },
    }

    const converted = importN8nWorkflow(cyclicalWorkflow)
    expect(converted.isValidDag).toBe(false)
    expect(converted.warnings.some(w => w.includes('cyclical connection'))).toBe(true)
  })
})
