// sdk/backend/nodes/n8n-bridge-node.ts
// Bridges the Lead Gen Desk DAG with a running n8n instance or Webhook workflow.

import { registerNode } from '../engine/registry'
import { makeDescriptor, strField, selectField, numField, boolField, jsonField, mainOutput, mainInput } from './descriptors'
import { evaluateTemplateExpression } from '../engine/transformer'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerN8nBridgeNode() {
  const handler: NodeHandler = {
    type: 'n8n_bridge' as any,
    async execute(ctx) {
      const webhookUrlRaw = (ctx.config.webhookUrl as string) || ''
      const method = ((ctx.config.method as string) || 'POST').toUpperCase()
      const timeoutMs = (ctx.config.timeoutMs as number) || 30000
      const waitForResponse = ctx.config.waitForResponse !== false
      const responseProperty = (ctx.config.responseProperty as string) || ''
      const customHeaders = (ctx.config.headers as Record<string, string>) || {}

      if (!webhookUrlRaw) {
        throw new Error('N8nBridgeNode: webhookUrl is required.')
      }

      const records = ctx.incoming.length > 0 ? ctx.incoming : [{ id: 'init', collection: 'default', data: ctx.input, meta: {} as any }]
      const outputRecords: PipelineRecord[] = []

      for (const rec of records) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const activeData = rec.data || {}
        const interpolatedUrl = evaluateTemplateExpression(webhookUrlRaw, {
          input: activeData,
          lead: activeData,
          record: activeData,
        })

        ctx.log('info', `[N8nBridgeNode] Calling n8n webhook: ${method} ${interpolatedUrl}`)

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'LeadGenDesk-N8nBridge/1.0',
          ...customHeaders,
        }

        try {
          const fetchOptions: RequestInit = {
            method,
            headers,
            signal: controller.signal,
          }

          if (method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = JSON.stringify({
              lead: activeData,
              metadata: {
                pipelineId: ctx.pipelineId,
                runId: ctx.runId,
                nodeId: ctx.nodeId,
              },
            })
          }

          const response = await fetch(interpolatedUrl, fetchOptions)

          if (!response.ok) {
            throw new Error(`n8n webhook returned HTTP ${response.status}: ${response.statusText}`)
          }

          let responseData: any = {}
          if (waitForResponse) {
            const text = await response.text()
            try {
              responseData = JSON.parse(text)
            } catch {
              responseData = { rawResponse: text }
            }
          }

          const mergedData = responseProperty
            ? { ...activeData, [responseProperty]: responseData }
            : typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData)
              ? { ...activeData, ...responseData }
              : { ...activeData, n8n_response: responseData }

          outputRecords.push({
            id: `${rec.id || ctx.nodeId}-n8n`,
            collection: rec.collection || 'leads',
            data: mergedData,
            meta: {
              ...rec.meta,
              sourceNodeId: ctx.nodeId,
            },
          })
        } catch (err: any) {
          ctx.log('error', `[N8nBridgeNode] Error contacting n8n webhook: ${err.message}`)
          throw err
        } finally {
          clearTimeout(timer)
        }
      }

      ctx.log('info', `[N8nBridgeNode] Emitting ${outputRecords.length} records`)
      ctx.emit(outputRecords)
    },
  }

  const descriptor = makeDescriptor({
    type: 'n8n_bridge' as any,
    name: 'n8n Bridge',
    description: 'Triggers an external or local n8n workflow webhook and merges the response back into the pipeline.',
    category: 'Output',
    icon: 'Network',
    color: '#FF6D5A', // n8n signature orange
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      webhookUrl: strField('n8n Webhook URL', true, 'Full URL of the n8n Webhook node trigger (supports {{ expressions }})'),
      method: selectField('HTTP Method', ['POST', 'GET', 'PUT'], 'HTTP method to use', 'POST'),
      waitForResponse: boolField('Wait for Response', 'If true, waits for n8n to complete execution before emitting', true),
      responseProperty: strField('Response Field (Optional)', false, 'If set, nests response under this key; otherwise merges at top level'),
      timeoutMs: numField('Timeout (ms)', false, 'Max time to wait for n8n execution', 30000),
      headers: jsonField('Custom Headers', 'Optional HTTP headers to include with the request', {}),
    },
  })

  registerNode(handler, descriptor)
}
