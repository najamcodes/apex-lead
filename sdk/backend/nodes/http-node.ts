// backend/nodes/http-node.ts
// Calls an external HTTP API. Maps response fields into the record.
// Supports {{input.x}} and {{record.x}} substitution, auth headers, response path extraction.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, jsonField, boolField, mainOutput, mainInput, getPath } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function registerHttpNode() {
  const handler: NodeHandler = {
    type: 'http',
    async execute(ctx) {
      const method = (ctx.config.method as string) || 'GET'
      let urlTemplate = ctx.config.url as string
      const headersConfig = (ctx.config.headers as Record<string, string>) || {}
      const bodyTemplate = ctx.config.body as string | undefined
      const responseField = (ctx.config.response_field as string) || 'http_response'
      const responsePath = ctx.config.response_path as string | undefined
      const timeoutMs = Number(ctx.config.timeout_ms) || 10000
      const authType = ctx.config.auth_type as string | undefined
      const authValue = ctx.config.auth_value as string | undefined
      const splitResponse = ctx.config.split_array === true || ctx.config.split_array === 'true'

      if (!urlTemplate) {
        ctx.log('error', 'No URL configured')
        return
      }

      // Build auth headers
      const authHeaders: Record<string, string> = {}
      if (authType === 'bearer' && authValue) {
        authHeaders['Authorization'] = `Bearer ${authValue}`
      } else if (authType === 'basic' && authValue) {
        authHeaders['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`
      } else if (authType === 'api_key' && authValue && ctx.config.auth_header) {
        authHeaders[ctx.config.auth_header as string] = authValue
      }

      // If no incoming records, do a single request with just the run input
      const sources: PipelineRecord[] = ctx.incoming.length > 0
        ? ctx.incoming
        : [{
            id: randomUUID(),
            collection: 'http_request',
            data: ctx.input,
            meta: {
              pipelineId: ctx.pipelineId,
              runId: ctx.runId,
              sourceNodeId: ctx.nodeId,
              orgId: ctx.orgId,
              createdAt: new Date().toISOString(),
              trace: [ctx.nodeId],
            },
          }]

      for (const rec of sources) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const mergedData = { ...ctx.input, ...rec.data }
        const url = substitute(urlTemplate, mergedData)

        try {
          const fetchOpts: RequestInit = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
              ...headersConfig,
            },
          }

          if (bodyTemplate && method !== 'GET' && method !== 'HEAD') {
            fetchOpts.body = substitute(bodyTemplate, mergedData)
          }

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)
          ctx.log('info', `${method} ${url}`)
          const res = await fetch(url, { ...fetchOpts, signal: controller.signal })
          clearTimeout(timer)

          const text = await res.text()
          let parsed: unknown = text
          try { parsed = JSON.parse(text) } catch { /* keep as text */ }

          // Extract sub-path from response if configured
          let responseData: unknown = parsed
          if (responsePath) {
            responseData = getPath(responsePath, parsed as Record<string, unknown>)
          }

          if (!res.ok) {
            ctx.log('warn', `HTTP ${res.status} from ${url}`)
          }

          // Split array mode: emit one record per array element
          if (splitResponse && Array.isArray(responseData)) {
            ctx.log('info', `HTTP: splitting ${responseData.length} array items`)
            for (const item of responseData) {
              const outRec: PipelineRecord = {
                id: randomUUID(),
                collection: rec.collection,
                data: { ...rec.data, [responseField]: item, _http_status: res.status },
                meta: { ...rec.meta, sourceNodeId: ctx.nodeId, trace: [...rec.meta.trace, ctx.nodeId] },
              }
              ctx.emit(outRec)
            }
          } else {
            const outRec: PipelineRecord = {
              id: randomUUID(),
              collection: rec.collection,
              data: { ...rec.data, [responseField]: responseData, _http_status: res.status },
              meta: { ...rec.meta, sourceNodeId: ctx.nodeId, trace: [...rec.meta.trace, ctx.nodeId] },
            }
            ctx.emit(outRec)
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
    description: 'Call an external REST API (GET/POST/PUT/PATCH/DELETE). Supports auth, response extraction, and array splitting.',
    category: 'Process',
    icon: 'Globe',
    color: '#06b6d4',
    isStart: true,
    produces: true,
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      method: selectField('Method', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], undefined, 'GET'),
      url: strField('URL', true, 'Supports {{input.field}} and {{record.field}} substitution.'),
      headers: jsonField('Headers', 'Custom request headers as a JSON object.'),
      body: strField('Body', false, 'Request body for POST/PUT/PATCH. Supports {{input.field}} substitution.'),
      auth_type: selectField('Auth type', ['none', 'bearer', 'basic', 'api_key'], 'Authentication method.', 'none'),
      auth_value: strField('Auth value', false, 'Bearer token, "user:pass" for Basic, or API key value.'),
      auth_header: strField('Auth header name', false, 'Header name for api_key auth (e.g. X-API-Key).'),
      response_field: strField('Response field', false, 'Field name to store response under.', 'http_response'),
      response_path: strField('Response path', false, 'Dot-path into the JSON response to extract (e.g. "data.items").'),
      split_array: boolField('Split array', 'If the response is an array, emit one record per element instead of one record with the array.'),
      timeout_ms: strField('Timeout (ms)', false, undefined, '10000'),
    },
    help: 'URL/body substitution: use {{input.field}} (from edge mappings) or {{record.field_name}}.\n\nResponse path: e.g. "results" extracts response.results from the JSON response.\n\nSplit array: great for APIs that return a list — each item becomes its own record.',
  })

  registerNode(handler, descriptor)
}

function substitute(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    const path = expr.trim().replace(/^(input|record)\./, '')
    const val = getPath(path, data)
    return val !== undefined && val !== null ? String(val) : ''
  })
}
