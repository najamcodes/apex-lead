import type { RequestContext as Context, Next } from 'katal'

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  keyGenerator: (c: Context) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const stores: Map<string, RateLimitStore> = new Map()

function getStore(name: string): RateLimitStore {
  if (!stores.has(name)) {
    stores.set(name, {})
  }
  return stores.get(name)!
}

function cleanupStore(name: string): void {
  const store = stores.get(name)
  if (!store) return

  const now = Date.now()
  for (const key of Object.keys(store)) {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  }
}

export function rateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator, skipSuccessfulRequests = false, skipFailedRequests = false } = options
  const storeName = `ratelimit:${windowMs}:${maxRequests}`
  const store = getStore(storeName)

  // Periodic cleanup
  setInterval(() => cleanupStore(storeName), windowMs)

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c)
    const now = Date.now()

    if (!store[key] || store[key].resetTime < now) {
      store[key] = { count: 0, resetTime: now + windowMs }
    }

    store[key].count++

    const remaining = Math.max(0, maxRequests - store[key].count)
    const resetTime = Math.ceil((store[key].resetTime - Date.now()) / 1000)

    if (typeof c.header === 'function') {
      c.header('X-RateLimit-Limit', maxRequests.toString())
      c.header('X-RateLimit-Remaining', remaining.toString())
      c.header('X-RateLimit-Reset', resetTime.toString())
    }

    if (store[key].count > maxRequests) {
      const body = { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' }
      const headers = {
        'Content-Type': 'application/json',
        'Retry-After': resetTime.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString(),
      }
      return typeof c.json === 'function' ? c.json(body, 429, headers) : new Response(JSON.stringify(body), { status: 429, headers })
    }

    const res = await next()
    const status = res?.status ?? c.res?.status ?? 200

    if (res instanceof Response) {
      res.headers.set('X-RateLimit-Limit', maxRequests.toString())
      res.headers.set('X-RateLimit-Remaining', remaining.toString())
      res.headers.set('X-RateLimit-Reset', resetTime.toString())
    }

    // Optional: skip counting based on response status
    if (skipSuccessfulRequests && status < 400) {
      store[key].count--
    }
    if (skipFailedRequests && status >= 400) {
      store[key].count--
    }

    return res
  }
}