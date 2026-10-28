import type { RequestContext, Next } from 'katal'
import type { AuthRequestContext } from './AuthMiddleware'

export interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
}

const hits = new Map<string, number[]>()

export function rateLimit(config: RateLimitConfig) {
  return async (context: RequestContext, next: Next) => {
    const authCtx = context as AuthRequestContext
    const req = context.request
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'
    const orgId = authCtx.user?.orgId || authCtx.state?.tenantId || 'public'
    const key = `${orgId}:${ip}`
    const now = Date.now()
    const windowStart = now - config.windowSeconds * 1000

    const timestamps = (hits.get(key) || []).filter(ts => ts > windowStart)
    if (timestamps.length >= config.maxRequests) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(config.windowSeconds),
        },
      })
    }

    timestamps.push(now)
    hits.set(key, timestamps)

    return await next()
  }
}

export function resetRateLimits() {
  hits.clear()
}
