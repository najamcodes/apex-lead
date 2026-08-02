// backend/nodes/vision-node.ts
// Multimodal Vision / Screenshot OCR node: extracts structured data from page screenshots or images using Vision LLMs.

import type { NodeExecutionContext, NodeHandler } from '../engine/types'
import { registerNode } from '../engine/registry'
import { getSettings } from '../db/queries/settings.queries'
import { resolveAiClient, type ChatMessage } from '../core/ai/ai-client'

export function registerVisionNode(): void {
  const handler: NodeHandler = {
    type: 'vision',
    async execute(ctx: NodeExecutionContext): Promise<void> {
      const mode = (ctx.config.input_mode as string) || 'image_url'
      const imageField = (ctx.config.image_field as string) || 'image_url'
      const promptTemplate = (ctx.config.prompt as string) ||
        'Analyze this webpage screenshot or document. Extract all business information, pricing plans, contact details, and key value propositions into structured JSON.'
      const model = (ctx.config.model as string) || 'gpt-4o-mini'
      const outputField = (ctx.config.output_field as string) || 'vision_extracted'

      const settings = await getSettings()
      const ai = await resolveAiClient(settings, ctx.config.ai_connection_id as string, ctx.orgId)

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const mergedData: Record<string, any> = { ...ctx.input, ...rec.data }
        let imageUri = ''

        if (mode === 'image_url') {
          imageUri = String(mergedData[imageField] || ctx.config.default_url || '')
        } else if (mode === 'base64') {
          const rawBase64 = String(mergedData[imageField] || '')
          imageUri = rawBase64.startsWith('data:') ? rawBase64 : `data:image/jpeg;base64,${rawBase64}`
        } else if (mode === 'screenshot_service') {
          // Use website_url to generate a screenshot service link (e.g. microlink or thum.io)
          const targetUrl = String(mergedData['website_url'] || mergedData[imageField] || '')
          if (targetUrl) {
            imageUri = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&screenshot=true&embed=screenshot.url`
          }
        }

        if (!imageUri) {
          ctx.log('warn', `Vision node: no image URI found for record ${rec.id}. Skipping.`)
          ctx.emit(rec)
          continue
        }

        // Interpolate prompt template with record fields
        const resolvedPrompt = promptTemplate.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const path = key.trim()
          return mergedData[path] !== undefined && mergedData[path] !== null ? String(mergedData[path]) : ''
        })

        ctx.log('info', `Vision node processing image for record ${rec.id} using model ${model}...`)

        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: 'You are an expert OCR and multimodal visual intelligence parser. Analyze the visual elements, text hierarchy, graphics, and layout carefully. Return valid structured JSON format only.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: resolvedPrompt },
              { type: 'image_url', image_url: { url: imageUri, detail: 'high' } },
            ],
          },
        ]

        try {
          const completion = await ai.complete({
            model,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.1,
          })

          let extractedData: any = {}
          try {
            const cleaned = (completion.content || '')
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/```\s*$/i, '')
              .trim()
            extractedData = JSON.parse(cleaned)
          } catch {
            extractedData = { raw_text: completion.content }
          }

          ctx.log('info', `Vision node extracted data successfully for record ${rec.id}.`)

          ctx.emit({
            ...rec,
            data: {
              ...rec.data,
              ...(typeof extractedData === 'object' ? extractedData : {}),
              [outputField]: extractedData,
            },
            meta: {
              ...rec.meta,
              sourceNodeId: ctx.nodeId,
              trace: [...(rec.meta?.trace || []), ctx.nodeId],
            },
          })
        } catch (err: any) {
          ctx.log('error', `Vision node failed: ${err.message}`)
          ctx.emit({
            ...rec,
            data: { ...rec.data, _vision_error: err.message },
          })
        }
      }
    },
  }

  const descriptor = {
    type: 'vision' as const,
    name: 'Vision & Screenshot OCR',
    description: 'Use Multimodal Vision LLMs (GPT-4o, Claude 3.5 Sonnet, Gemini) to extract structured data from screenshots and canvas-rendered sites.',
    category: 'Process' as const,
    icon: 'Eye',
    color: '#06b6d4',
    isStart: false,
    inputs: [
      {
        id: 'main',
        label: 'Input Records',
        schema: { fields: {}, multiple: true, description: 'Records containing image URLs, screenshots, or website URLs' },
      },
    ],
    outputs: [
      {
        id: 'main',
        label: 'Extracted Output',
        schema: { fields: {}, multiple: true, description: 'Records enriched with visual OCR data' },
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
      input_mode: {
        type: 'select',
        label: 'Input Source Mode',
        options: [
          { label: 'Image URL field in record', value: 'image_url' },
          { label: 'Base64 image field in record', value: 'base64' },
          { label: 'Auto Screenshot from website_url', value: 'screenshot_service' },
        ],
        default: 'screenshot_service',
        required: true,
      },
      image_field: {
        type: 'string',
        label: 'Image / Website Field Name',
        description: 'Field in record containing the image URL, base64 payload, or website URL',
        default: 'website_url',
        required: true,
      },
      prompt: {
        type: 'string',
        label: 'Extraction Prompt',
        description: 'Prompt describing what data points to extract from the visual layout.',
        default: 'Extract all pricing tiers, pricing numbers, phone numbers, contact emails, and hero headline from this visual webpage screenshot into structured JSON.',
        required: true,
      },
      model: {
        type: 'string',
        label: 'Vision Model',
        description: 'Multimodal vision model name',
        default: 'gpt-4o-mini',
      },
      output_field: {
        type: 'string',
        label: 'Output Field Name',
        description: 'Field to store extracted visual analysis in the record payload',
        default: 'visual_intelligence',
      },
    },
  }

  registerNode(handler, descriptor)
}
