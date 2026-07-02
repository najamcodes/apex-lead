import { Context, Next } from 'hono'
import { logger } from '../utils/logger'

export function logRequest() {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const method = c.req.method
    const path = c.req.path
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    await next()

    const duration = Date.now() - start
    const status = c.res.status

    const logData = {
      method,
      path,
      status,
      durationMs: duration,
      ip,
      userAgent: c.req.header('user-agent') || 'unknown',
    }

    if (status >= 500) {
      logger.error({ ...logData, error: 'Server error' }, 'Request completed with error')
    } else if (status >= 400) {
      logger.warn({ ...logData }, 'Request completed with client error')
    } else {
      logger.info(logData, 'Request completed')
    }
  }
}