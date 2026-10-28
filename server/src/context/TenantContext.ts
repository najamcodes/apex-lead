import { AsyncLocalStorage } from 'node:async_hooks';
import {
  getRequestUser,
  runWithUser,
  getTenantId,
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentUserPermissions,
  getCurrentOrgId,
  canManageOrg,
  type RequestUser,
} from '../context';

export interface TenantUserContext {
  id: number;
  orgId: number;
  role: string;
  permissions: string[];
  email?: string;
  name?: string | null;
  requestId?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantUserContext>();

export function getTenantContext(): TenantUserContext | undefined {
  return tenantStorage.getStore();
}

export function getRequiredTenantContext(): TenantUserContext {
  const ctx = getTenantContext();
  if (!ctx || !ctx.orgId) {
    throw new Error('Tenant context is required but was not provided on this request.');
  }
  return ctx;
}

export function runWithTenantContext<R>(context: TenantUserContext, fn: () => R): R {
  return tenantStorage.run(context, fn);
}

export const TenantContext = {
  run: <R>(orgId: number, fn: () => R): R => {
    return runWithTenantContext({ id: 1, orgId, role: 'user', permissions: [] }, () => {
      return runWithUser({ id: 1, org_id: orgId, role: 'user', permissions: [] }, fn);
    });
  },
  runWithUser: <R>(user: TenantUserContext, fn: () => R): R => {
    return runWithTenantContext(user, () => {
      return runWithUser({
        id: user.id,
        org_id: user.orgId,
        role: user.role,
        permissions: user.permissions || [],
        email: user.email,
        name: user.name,
      }, fn);
    });
  },
  get: getTenantContext,
};

export {
  getRequestUser,
  runWithUser,
  getTenantId,
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentUserPermissions,
  getCurrentOrgId,
  canManageOrg,
  type RequestUser,
};
