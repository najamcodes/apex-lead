// backend/nodes/agent-node.ts
// Autonomous AI Agent node: multi-step ReAct reasoning loop with tool calling.

import type { NodeExecutionContext, NodeHandler } from '../engine/types'
import { registerNode } from '../engine/registry'
import { getDataSource } from '../db'
import { getSettings } from '../db/queries/settings.queries'
import { resolveAiClient, type ToolDefinition, type ChatMessage } from '@sdk/core/ai/ai-client'
import { CollectionRecordEntity } from '../db/entities/CollectionRecordEntity'
import { LeadEntity } from '../db/entities/LeadEntity'

// ─────────────────────────────────────────────────────────────────
// Built-in Autonomous Agent Tools
// ─────────────────────────────────────────────────────────────────

const AGENT_TOOL_DEFS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the public web for real-time information, company details, news, social profiles, or pricing.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to look up on the web' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch and extract clean text content from a specific webpage URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL of the website to scrape and read' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'database_query',
      description: 'Search the internal database (leads or collections) for existing records and intelligence.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', description: 'Collection name, e.g. "leads" or custom collection' },
          query: { type: 'string', description: 'Keyword to search for in business name, city, email, or data' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculator_js',
      description: 'Execute a mathematical calculation or JavaScript transformation logic safely.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'A JS expression to compute, e.g. "125000 * 0.15" or "[\'a\',\'b\'].join(\',\')"' },
        },
        required: ['expression'],
      },
    },
  },
]

async function executeAgentTool(name: string, args: Record<string, any>, orgId: number): Promise<any> {
  switch (name) {
    case 'web_search': {
      const q = encodeURIComponent(args.query || '')
      try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        const html = await res.text()
        // Extract snippet links and text
        const snippets: string[] = []
        const regex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g
        let match
        while ((match = regex.exec(html)) !== null && snippets.length < 5) {
          snippets.push(match[1].replace(/<[^>]+>/g, '').trim())
        }
        return snippets.length > 0 ? snippets : `Search query "${args.query}" executed. No direct snippets found.`
      } catch (err: any) {
        return `Search failed: ${err.message}`
      }
    }

    case 'web_fetch': {
      const url = args.url
      if (!url || !url.startsWith('http')) return 'Invalid URL provided.'
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        })
        const html = await res.text()
        const text = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000)
        return text || 'Webpage returned empty text.'
      } catch (err: any) {
        return `Failed to fetch webpage: ${err.message}`
      }
    }

    case 'database_query': {
      const ds = getDataSource()
      const coll = args.collection || 'leads'
      const search = (args.query || '').toLowerCase()

      if (coll === 'leads') {
        const repo = ds.getRepository(LeadEntity)
        const results = await repo.createQueryBuilder('l')
          .where('l.org_id = :orgId', { orgId })
          .andWhere('(LOWER(l.business_name) LIKE :q OR LOWER(l.city) LIKE :q OR LOWER(l.category) LIKE :q)', { q: `%${search}%` })
          .take(5)
          .getMany()
        return results.map(l => ({
          business_name: l.business_name,
          city: l.city,
          category: l.category,
          website: l.website_url,
          email: l.email,
          phone: l.phone,
        }))
      } else {
        const repo = ds.getRepository(CollectionRecordEntity)
        const results = await repo.createQueryBuilder('cr')
          .where('cr.org_id = :orgId AND cr.collection = :coll', { orgId, coll })
          .andWhere('LOWER(cr.data) LIKE :q', { q: `%${search}%` })
          .take(5)
          .getMany()
        return results.map(r => {
          try { return JSON.parse(r.data) } catch { return r.data }
        })
      }
    }

    case 'calculator_js': {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`'use strict'; return (${args.expression})`)
        return fn()
      } catch (err: any) {
        return `Math/eval error: ${err.message}`
      }
    }

    default:
      return `Unknown tool "${name}".`
  }
}

// ─────────────────────────────────────────────────────────────────
// Node Handler Registration
// ─────────────────────────────────────────────────────────────────

export function registerAgentNode(): void {
  const handler: NodeHandler = {
    type: 'agent',
    async execute(ctx: NodeExecutionContext): Promise<void> {
      const systemPrompt = (ctx.config.system_prompt as string) ||
        'You are an autonomous AI research and intelligence agent. You have access to tools to search the web, fetch pages, query data, and compute results. Reason step-by-step, use tools when needed, and return a final comprehensive JSON answer.'
      
      const userGoalTemplate = (ctx.config.goal as string) || (ctx.config.prompt as string) ||
        'Research and extract verified details for: {{business_name}} located in {{city}}.'

      const maxSteps = Math.min(15, Math.max(1, parseInt(String(ctx.config.max_steps || '6'), 10)))
      const model = (ctx.config.model as string) || 'gpt-4o'
      const outputField = (ctx.config.output_field as string) || 'agent_result'

      const settings = await getSettings()
      const ai = await resolveAiClient(settings, ctx.config.ai_connection_id as string, ctx.orgId)

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        // 1. Interpolate user goal template with record data
        const mergedData: Record<string, any> = { ...ctx.input, ...rec.data }
        const resolvedGoal = userGoalTemplate.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const path = key.trim()
          return mergedData[path] !== undefined && mergedData[path] !== null ? String(mergedData[path]) : ''
        })

        ctx.log('info', `Agent starting goal: "${resolvedGoal.slice(0, 80)}..." (Max Steps: ${maxSteps})`)

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: resolvedGoal },
        ]

        let step = 0
        let finalAnswer = ''
        let structuredResult: any = null

        while (step < maxSteps) {
          if (ctx.isCancelled()) break
          await ctx.isPaused()

          step++
          ctx.log('info', `Agent reasoning step ${step}/${maxSteps}...`)

          try {
            const completion = await ai.complete({
              model,
              messages,
              tools: AGENT_TOOL_DEFS,
              tool_choice: 'auto',
              temperature: 0.2,
            })

            // Check if model invoked tool calls
            if (completion.tool_calls && completion.tool_calls.length > 0) {
              // Add assistant message with tool calls to history
              messages.push({
                role: 'assistant',
                content: completion.content || '',
                tool_calls: completion.tool_calls,
              })

              for (const tc of completion.tool_calls) {
                let parsedArgs: any = {}
                try { parsedArgs = JSON.parse(tc.function.arguments || '{}') } catch {}

                ctx.log('info', `Agent executing tool [${tc.function.name}] with: ${JSON.stringify(parsedArgs).slice(0, 100)}`)
                const toolOutput = await executeAgentTool(tc.function.name, parsedArgs, ctx.orgId)

                // Append tool response
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  content: typeof toolOutput === 'object' ? JSON.stringify(toolOutput) : String(toolOutput),
                })
              }
            } else {
              // Model provided final answer without calling tools
              finalAnswer = completion.content || ''
              ctx.log('info', `Agent completed goal at step ${step}.`)

              // Try parsing final answer as JSON if formatted as such
              try {
                const cleaned = finalAnswer
                  .replace(/^```json\s*/i, '')
                  .replace(/^```\s*/i, '')
                  .replace(/```\s*$/i, '')
                  .trim()
                if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
                  structuredResult = JSON.parse(cleaned)
                }
              } catch {}
              break
            }
          } catch (err: any) {
            ctx.log('warn', `Agent step ${step} error: ${err.message}`)
            break
          }
        }

        // Emit enriched record
        const outputPayload = structuredResult
          ? (typeof structuredResult === 'object' && !Array.isArray(structuredResult)
            ? { ...rec.data, ...structuredResult, [outputField]: structuredResult }
            : { ...rec.data, [outputField]: structuredResult })
          : { ...rec.data, [outputField]: finalAnswer }

        ctx.emit({
          ...rec,
          data: outputPayload,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta?.trace || []), ctx.nodeId],
          },
        })
      }
    },
  }

  const descriptor = {
    type: 'agent' as const,
    name: 'AI Agent (Tool Use)',
    description: 'Autonomous multi-step reasoning agent with Web Search, Web Scraping, Database Querying, and Calculation tools.',
    category: 'Process' as const,
    icon: 'Bot',
    color: '#8b5cf6',
    isStart: false,
    inputs: [
      {
        id: 'main',
        label: 'Input Records',
        schema: { fields: {}, multiple: true, description: 'Records to provide context for the agent' },
      },
    ],
    outputs: [
      {
        id: 'main',
        label: 'Agent Output',
        schema: { fields: {}, multiple: true, description: 'Records enriched with autonomous agent intelligence' },
      },
    ],
    produces: true,
    configSchema: {
      ai_connection_id: {
        type: 'select',
        label: 'AI Connection Profile',
        description: 'Choose a specific AI setup (e.g. Local Ollama, LM Studio, OpenAI) or use the global default.',
        options: [{ label: 'Default (From Settings)', value: '' }],
        default: '',
      },
      goal: {
        type: 'string',
        label: 'Agent Goal Template',
        description: 'Goal for the agent. Supports {{field}} placeholders.',
        default: 'Perform in-depth research on {{business_name}} in {{city}} and extract their main services and key decision makers.',
        required: true,
      },
      system_prompt: {
        type: 'string',
        label: 'System Instructions',
        description: 'Persona and constraints for the autonomous agent.',
        default: 'You are an elite research agent. Use web_search and web_fetch to find authoritative answers. Return your final result in clear structured JSON.',
      },
      model: {
        type: 'string',
        label: 'Model',
        description: 'LLM model to use (e.g. gpt-4o, claude-3-5-sonnet, gemini-1.5-pro)',
        default: 'gpt-4o',
      },
      max_steps: {
        type: 'number',
        label: 'Max Reasoning Steps',
        description: 'Maximum tool-call iterations before returning final answer (1-15)',
        default: 6,
      },
      output_field: {
        type: 'string',
        label: 'Output Field Name',
        description: 'Field to store the agent results in the record payload',
        default: 'agent_intelligence',
      },
    },
  }

  registerNode(handler, descriptor)
}
