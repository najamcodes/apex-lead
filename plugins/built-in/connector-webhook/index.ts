// plugins/built-in/connector-webhook/index.ts
// Posts lead events to any HTTP endpoint.
// Compatible with Zapier, Make (Integromat), n8n, and custom receivers.
// Supports HMAC-SHA256 request signing for webhook verification.

import { z } from 'zod'
import { createHmac } from 'crypto'
import type { ConnectorPlugin, PluginEvent, PluginTrigger } from '../../types'

export const ALL_TRIGGERS: PluginTrigger[] = [
  'lead.created',
  'lead.qualified',
  'lead.approved',
  'lead.skipped',
  'lead.closed',
  'outreach.sent',
  'outreach.replied',
  'outreach.bounced',
]

const ConfigSchema = z.object({
  /** The URL to POST to. */
  url: z.string().url('Must be a valid webhook URL'),

  /** Only fire on these triggers (defaults to all if empty). */
  triggers: z
    .array(z.enum([
      'lead.created', 'lead.qualified', 'lead.approved', 'lead.skipped',
      'lead.closed', 'outreach.sent', 'outreach.replied', 'outreach.bounced',
    ]))
    .default([]),

  /** Optional HMAC secret for request signing (X-LeadHunter-Signature header). */
  secret: z.string().optional(),

  /**
   * Additional headers to send with every request.
   * Useful for API tokens: { "Authorization": "Bearer ..." }
   */
  headers: z.record(z.string(), z.string()).default({}),

  /** Request timeout in ms. */
  timeout_ms: z.number().int().min(1000).max(30000).default(10000),

  /** Number of retries on network failure (5xx). */
  retries: z.number().int().min(0).max(5).default(2),
})

export type WebhookConfig = z.infer<typeof ConfigSchema>

function signPayload(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
}

async function postWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
  retriesLeft: number,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.status >= 500 && retriesLeft > 0) {
      // Exponential backoff before retry
      await new Promise(r => setTimeout(r, 1000 * (3 - retriesLeft)))
      return postWithRetry(url, body, headers, timeoutMs, retriesLeft - 1)
    }

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}: ${await res.text().catch(() => '')}`)
    }
  } catch (err) {
    clearTimeout(timer)
    if (retriesLeft > 0 && !(err instanceof Error && err.name === 'AbortError')) {
      await new Promise(r => setTimeout(r, 1000 * (3 - retriesLeft)))
      return postWithRetry(url, body, headers, timeoutMs, retriesLeft - 1)
    }
    throw err
  }
}

const webhookConnector: ConnectorPlugin = {
  kind: 'connector',
  id: 'connector-webhook',
  name: 'Webhook Connector',
  version: '1.0.0',
  description: 'Posts lead events to any HTTP endpoint (Zapier, Make, n8n, custom).',
  author: 'LeadHunter',
  configSchema: ConfigSchema,

  // Subscribe to all triggers — filtered per-config in push()
  on: ALL_TRIGGERS,

  async push(event: PluginEvent, rawConfig: Record<string, unknown>): Promise<void> {
    const config = ConfigSchema.parse(rawConfig)

    // Apply per-config trigger filter
    if (config.triggers.length > 0 && !config.triggers.includes(event.trigger)) {
      return
    }

    const payload = JSON.stringify({
      trigger:    event.trigger,
      org_id:     event.org_id,
      timestamp:  new Date().toISOString(),
      lead: {
        id:             event.lead.id,
        business_name:  event.lead.business_name,
        category:       event.lead.category,
        city:           event.lead.city,
        country:        event.lead.country,
        phone:          event.lead.phone,
        email:          event.lead.email,
        website_url:    event.lead.website_url,
        google_maps_url: event.lead.google_maps_url,
        ai_site_score:  event.lead.ai_site_score,
        status:         event.lead.status,
        source:         event.lead.source,
      },
      metadata: event.metadata ?? null,
    })

    const headers: Record<string, string> = { ...config.headers }
    if (config.secret) {
      headers['X-LeadHunter-Signature'] = signPayload(payload, config.secret)
      headers['X-LeadHunter-Timestamp'] = String(Date.now())
    }

    await postWithRetry(config.url, payload, headers, config.timeout_ms, config.retries)
  },
}

export default webhookConnector
