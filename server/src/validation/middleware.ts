import type { RequestContext as Context, Next } from 'katal'
import { z } from 'zod'

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json()
      const result = schema.safeParse(body)
      if (!result.success) {
        return c.json(
          { error: 'Invalid request body', details: result.error.flatten().fieldErrors },
          400
        )
      }
      c.set('validatedBody', result.data)
      await next()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
  }
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query()
      const result = schema.safeParse(query)
      if (!result.success) {
        return c.json(
          { error: 'Invalid query parameters', details: result.error.flatten().fieldErrors },
          400
        )
      }
      c.set('validatedQuery', result.data)
      await next()
    } catch {
      return c.json({ error: 'Invalid query parameters' }, 400)
    }
  }
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param()
      const result = schema.safeParse(params)
      if (!result.success) {
        return c.json(
          { error: 'Invalid route parameters', details: result.error.flatten().fieldErrors },
          400
        )
      }
      c.set('validatedParams', result.data)
      await next()
    } catch {
      return c.json({ error: 'Invalid route parameters' }, 400)
    }
  }
}

export function getValidatedBody<T>(c: Context): T {
  return c.get('validatedBody') as T
}

export function getValidatedQuery<T>(c: Context): T {
  return c.get('validatedQuery') as T
}

export function getValidatedParams<T>(c: Context): T {
  return c.get('validatedParams') as T
}