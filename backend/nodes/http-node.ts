// backend/nodes/http-node.ts
// Calls an external HTTP API. Maps response fields into the record.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, jsonField, mainOutput, mainInput } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

export function registerHttpNode() {
  const handler: NodeHandler = {
    type: 'http',
    async execute(ctx) {
      const method = (ctx.config.method as string) || 'GET'
      let url = ctx.config.url as string
      const headers = (ctx.config.headers as Record<string, string>) || {}
      const bodyTemplate = ctx.config.body as string | undefined
      const responseField = (ctx.config.response_field as string) || 'http_response'
      const timeoutMs = (ctx.config.timeout_ms as number) || 10000

      if (!url) {
        ctx.log('error', 'No URL configured')
        return
      }

      // Substitute {{input.x}} placeholders in URL and body
      url = substitute(url, ctx.input)

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()
        try {
          const fetchOpts: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } }
          if (bodyTemplate && method !== 'GET') {
            fetchOpts.body = substitute(bodyTemplate, { ...ctx.input, ...rec.data })
          }

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)
          ctx.log('info', `${method} ${url}`)
          const res = await fetch(url, { ...fetchOpts, signal: controller.signal })
          clearTimeout(timer)

          const text = await res.text()
          let parsed: unknown = text
          try { parsed = JSON.parse(text) } catch { /* keep as text */ }

          const outData = { ...rec.data, [responseField]: parsed, _http_status: res.status }
          const outRec: PipelineRecord = {
            ...rec,
            id: randomUUID(),
            data: outData,
            meta: { ...rec.meta, sourceNodeId: ctx.nodeId, trace: [...rec.meta.trace, ctx.nodeId] },
          }
          ctx.emit(outRec)

          if (!res.ok) {
            ctx.log('warn', `HTTP ${res.status} from ${url}`)
          }
        } catch (err) {
          ctx.log('error', `HTTP call failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'http',
    name: 'HTTP Request',
    description: 'Calls an external API (GET/POST/PUT/DELETE). Response is stored on the record.',
    category: 'Process',
    icon: 'Globe',
    color: '#06b6d4',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      method: selectField('Method', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], undefined, 'GET'),
      url: strField('URL', true, 'Supports {{input.field}} substitution. e.g. https://api.example.com/{{input.id}}'),
      headers: jsonField('Headers', 'JSON object of HTTP headers.'),
      body: strField('Body template', false, 'Request body for non-GET. Supports {{input.field}} and {{field}} from the record.'),
      response_field: strField('Response field', false, 'Field name to store the response under.', 'http_response'),
      timeout_ms: strField('Timeout (ms)', false, undefined, '10000'),
    },
    help: 'Use {{input.x}} in URL/body to inject mapped values. The response is parsed as JSON if possible and stored under the response field.',
  })

  registerNode(handler, descriptor)
}

function substitute(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    const path = expr.trim().replace(/^input\./, '')
    const val = getPath(path, input)
    return val !== undefined && val !== null ? String(val) : ''
  })
}

function getPath(path: string, obj: Record<string, unknown> | undefined): unknown {
  if (!obj) return undefined
  if (!path.includes('.')) return obj[path]
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else return undefined
  }
  return cur
}
