// backend/nodes/ai-node.ts
// Calls an LLM with a user-defined prompt template + mapped inputs.
// This generalizes the old hardcoded score-site.ts / draft-outreach.ts.

import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, textField, selectField, mainOutput, mainInput, getPath } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerAiNode() {
  const handler: NodeHandler = {
    type: 'ai',
    async execute(ctx) {
      const promptTemplate = ctx.config.prompt as string
      const model = (ctx.config.model as string) || 'anthropic/claude-3-haiku'
      const outputField = (ctx.config.output_field as string) || 'ai_result'

      if (!promptTemplate) {
        ctx.log('error', 'No prompt template configured')
        return
      }

      // Resolve the prompt: substitute {{input.x}} placeholders from ctx.input
      const resolvedPrompt = resolvePrompt(promptTemplate, ctx.input)
      ctx.log('info', `Calling AI model ${model}`)

      try {
        // Lazy import to avoid loading the AI client when this node isn't used
        const { resolveAiClient } = await import('@sdk/core/ai/ai-client')
        const { getSettings } = await import('../db/queries/settings.queries')
        const settings = await getSettings()
        const client = await resolveAiClient(settings, ctx.config.ai_connection_id as string, ctx.orgId)

        const response = await client.complete({
          model,
          messages: [{ role: 'user', content: resolvedPrompt }],
          temperature: typeof ctx.config.temperature === 'number' ? ctx.config.temperature : parseFloat(String(ctx.config.temperature || '0.7')),
          max_tokens: typeof ctx.config.max_tokens === 'number' ? ctx.config.max_tokens : parseInt(String(ctx.config.max_tokens || '1000'), 10),
        })

        // Emit a record that merges the input + the AI result
        const outData: Record<string, unknown> = { ...ctx.input }
        outData[outputField] = response.content

        // If the AI returned JSON (structured output), parse and merge
        if (ctx.config.parse_json === true || ctx.config.parse_json === 'true') {
          try {
            const parsed = JSON.parse(response.content)
            outData[outputField] = parsed
          } catch {
            // keep raw text
          }
        }

        const rec: PipelineRecord = {
          id: randomUUID(),
          collection: (ctx.incoming[0]?.collection) ?? 'ai_output',
          data: outData,
          meta: {
            pipelineId: ctx.pipelineId,
            runId: ctx.runId,
            sourceNodeId: ctx.nodeId,
            orgId: ctx.orgId,
            createdAt: new Date().toISOString(),
            trace: [...(ctx.incoming[0]?.meta.trace ?? []), ctx.nodeId],
          },
        }
        ctx.emit(rec)
        ctx.log('info', `AI responded (${response.content.length} chars) via ${client.getProvider()}`)
      } catch (err) {
        ctx.log('error', `AI call failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'ai',
    name: 'AI / LLM',
    description: 'Calls an LLM with a configurable prompt template. Use {{input.field}} to inject mapped values.',
    category: 'Process',
    icon: 'Sparkles',
    color: '#8b5cf6',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      ai_connection_id: selectField('AI Connection Profile', [''], 'Choose a specific AI setup (e.g. Local Ollama, LM Studio, OpenAI) or use the global default.', ''),
      model: strField('Model', false, 'e.g. anthropic/claude-3-haiku, gpt-4o', 'anthropic/claude-3-haiku'),
      prompt: textField('Prompt template', true, 'Use {{input.field}} to inject mapped input values. e.g. "Score this site: {{input.website_url}}"'),
      output_field: strField('Output field', false, 'Where to store the AI response on the record.', 'ai_result'),
      temperature: strField('Temperature', false, '0-1 creativity. Default 0.7.', '0.7'),
      max_tokens: strField('Max tokens', false, undefined, '1000'),
      parse_json: selectField('Parse JSON', ['false', 'true'], 'If true, parse the response as JSON and store the object.'),
    },
    help: 'The prompt supports {{input.field}} substitution using fields mapped on the incoming edge. The response is stored under the configured output field.',
  })

  registerNode(handler, descriptor)
}

/** Replace {{input.x}} and {{x}} in a prompt with values from the input object. */
function resolvePrompt(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    const trimmed = expr.trim()
    const path = trimmed.replace(/^input\./, '')
    const val = getPath(path, input)
    return val !== undefined ? String(val) : ''
  })
}
