import type { RequestContext as Context, Next } from 'katal'
import { logger } from '../utils/logger'

export function logRequest() {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const ctx = c as unknown as { request?: Request }
    const req = ctx.request || c.req?.raw || {}
    const method = req.method || c.req?.method || 'GET'
    const urlStr = req.url || c.req?.url || '/'
    const path = new URL(urlStr, 'http://localhost').pathname
    const getHeader = (name: string) => req.headers?.get?.(name) || c.req?.header?.(name) || undefined
    const ip = getHeader('x-forwarded-for') || getHeader('x-real-ip') || 'unknown'

    const res = await next()

    const duration = Date.now() - start
    const status = res?.status ?? c.res?.status ?? 200

    const logData = {
      method,
      path,
      status,
      durationMs: duration,
      ip,
      userAgent: getHeader('user-agent') || 'unknown',
    }

    if (status >= 500) {
      logger.error({ ...logData, error: 'Server error' }, 'Request completed with error')
    } else if (status >= 400) {
      logger.warn({ ...logData }, 'Request completed with client error')
    } else {
      logger.info(logData, 'Request completed')
    }

    return res
  }
}