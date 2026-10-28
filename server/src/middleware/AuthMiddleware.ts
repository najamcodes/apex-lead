import type { RequestContext, Next } from 'katal'
import { verifyAccessToken } from '../auth/jwt'
import { TenantContext } from '../context/TenantContext'

export interface AuthenticatedUser {
  id: number
  email: string
  orgId: number
  role: string
  systemRole: string
}

export type AuthRequestContext = RequestContext & {
  user?: AuthenticatedUser
  state?: Record<string, unknown>
}

export function authMiddleware(options: { optional?: boolean } = {}) {
  return async (context: RequestContext, next: Next) => {
    const authCtx = context as AuthRequestContext
    const authHeader = context.request.headers.get('authorization')
    let token: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim()
    } else {
      const cookieHeader = context.request.headers.get('cookie') || ''
      const match = cookieHeader.match(/apex_access_token=([^;]+)/)
      if (match) token = decodeURIComponent(match[1])
    }

    if (!token) {
      if (options.optional) {
        return next()
      }
      return new Response(JSON.stringify({ error: 'Missing or malformed Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const payload = verifyAccessToken(token)
      const user: AuthenticatedUser = {
        id: payload.userId,
        email: payload.email,
        orgId: payload.orgId,
        role: payload.role,
        systemRole: payload.systemRole,
      }

      authCtx.user = user
      context.user = user as unknown as import('katal').User
      if (!authCtx.state) authCtx.state = {}
      authCtx.state.userId = user.id
      authCtx.state.tenantId = user.orgId
      authCtx.state.userOrgRole = user.role
      authCtx.state.systemRole = user.systemRole

      return await TenantContext.runWithUser(
        {
          id: user.id,
          orgId: user.orgId,
          role: user.role,
          permissions: [],
          email: user.email,
        },
        () => next()
      )
    } catch (err: unknown) {
      if (options.optional) {
        return next()
      }
      const detail = err instanceof Error ? err.message : String(err)
      return new Response(JSON.stringify({ error: 'Invalid or expired access token', detail }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
