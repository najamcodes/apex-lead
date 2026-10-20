// sdk/backend/nodes/webhook-dispatcher-node.ts
// Outbound webhook dispatcher with HMAC SHA-256 signature signing and retry policies.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  numField,
  jsonField,
  boolField,
  selectField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import crypto from 'crypto'

export function computeHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export function registerWebhookDispatcherNode() {
  const handler: NodeHandler = {
    type: 'webhook_dispatcher' as any,
    async execute(ctx) {
      const url = ctx.config.url as string
      const method = ((ctx.config.method as string) || 'POST').toUpperCase()
      const secret = (ctx.config.signingSecret as string) || ''
      const customHeaders = (ctx.config.headers as Record<string, string>) || {}
      const maxRetries = Math.max(0, Math.min(3, Number(ctx.config.retries ?? 1)))
      const simulate = Boolean(ctx.config.simulate)

      if (!url && !simulate) {
        ctx.log('error', '[WebhookDispatcher] No webhook destination URL configured.')
        return
      }

      const deliveredRecords: PipelineRecord[] = []
      const failedRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const payloadString = JSON.stringify({
          event: 'lead.processed',
          timestamp: new Date().toISOString(),
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          data: rec.data,
          meta: rec.meta,
        })

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'ApexLead-Webhook-Dispatcher/1.0',
          ...customHeaders,
        }

        if (secret) {
          const sig = computeHmacSignature(payloadString, secret)
          headers['X-ApexLead-Signature'] = `sha256=${sig}`
        }

        let success = false
        let responseStatus = 0
        let responseBody: any = null
        let errorMessage: string | null = null

        if (simulate) {
          success = true
          responseStatus = 200
          responseBody = { success: true, mockId: `mock_${rec.id}` }
        } else {
          let attempt = 0
          while (attempt <= maxRetries && !success) {
            attempt++
            try {
              const controller = new AbortController()
              const timeout = setTimeout(() => controller.abort(), 10000)

              const res = await fetch(url, {
                method,
                headers,
                body: method !== 'GET' && method !== 'HEAD' ? payloadString : undefined,
                signal: controller.signal,
              })
              clearTimeout(timeout)

              responseStatus = res.status
              const resText = await res.text()
              try {
                responseBody = JSON.parse(resText)
              } catch {
                responseBody = resText
              }

              if (res.ok) {
                success = true
              } else {
                errorMessage = `HTTP ${res.status}: ${resText.slice(0, 200)}`
              }
            } catch (fetchErr) {
              errorMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
              if (attempt <= maxRetries) {
                await new Promise((r) => setTimeout(r, attempt * 500))
              }
            }
          }
        }

        const updatedData: Record<string, unknown> = {
          ...rec.data,
          _webhookDelivered: success,
          _webhookStatus: responseStatus,
          _webhookResponse: responseBody,
          _webhookError: errorMessage,
        }

        const outRec: PipelineRecord = {
          ...rec,
          data: updatedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        if (success) {
          deliveredRecords.push(outRec)
        } else {
          failedRecords.push(outRec)
        }
      }

      ctx.log(
        'info',
        `[WebhookDispatcher] Delivered: ${deliveredRecords.length}, Failed: ${failedRecords.length}`
      )

      ctx.emit(deliveredRecords, 'main')
      if (failedRecords.length > 0) {
        ctx.emit(failedRecords, 'failed')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'webhook_dispatcher' as any,
    name: 'Webhook Dispatcher',
    description: 'Dispatches real-time outbound webhooks with HMAC SHA-256 signing, retry logic, and delivery tracking.',
    category: 'Output',
    icon: 'Radio',
    color: '#3B82F6',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'failed', label: 'Delivery Failed', schema: anySchema },
    ],
    configSchema: {
      url: strField('Target Webhook URL', true, 'Destination URL (e.g. Zapier, Make, Slack, Customer.io, internal API)'),
      method: selectField('HTTP Method', ['POST', 'PUT', 'PATCH'], 'HTTP method for webhook dispatch', 'POST'),
      signingSecret: strField('Signing Secret (HMAC)', false, 'Secret key to sign payload with X-ApexLead-Signature header'),
      headers: jsonField('Custom Headers', 'Optional JSON object with custom headers'),
      retries: numField('Max Retries', false, 'Number of retries with backoff on failure', 1),
      simulate: boolField('Simulate (Offline Mode)', 'Mock successful webhook delivery for test suites', false),
    },
    help: 'Dispatches records to external webhook endpoints in real-time.\n\nProvides cryptographic HMAC SHA-256 signatures in the "X-ApexLead-Signature" header so receiving servers can verify authenticity.',
  })

  registerNode(handler, descriptor)
}
