import { createToken } from '../../server/src/auth'

export async function generateTestJwt(payload: { id?: number; userId?: number; org_id?: number; role?: string } = {}) {
  const userId = payload.id ?? payload.userId ?? 1
  const orgId = payload.org_id ?? 1
  const role = payload.role ?? 'super_admin'

  return await createToken({
    id: userId,
    org_id: orgId,
    role,
  })
}
