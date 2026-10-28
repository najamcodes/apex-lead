import type { RequestContext, Next } from 'katal'
import type { AuthRequestContext } from './AuthMiddleware'
import { hasPermission, RoleName } from '../context/permissions'

export function requireRole(minimumRole: RoleName) {
  return async (context: RequestContext, next: Next) => {
    const authCtx = context as AuthRequestContext
    const user = authCtx.user
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const role = user.role || user.systemRole
    if (!hasPermission(role, minimumRole)) {
      return new Response(JSON.stringify({
        error: `Forbidden: Requires minimum role '${minimumRole}'`,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return await next()
  }
}
