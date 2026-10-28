import type { RequestContext } from 'katal';
import { getTenantId } from '../../context';

export function resolveOrgId(context: RequestContext): number {
  const headerOrgId = context.request?.headers?.get('x-org-id');
  if (headerOrgId) {
    const parsed = parseInt(headerOrgId, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return getTenantId() || 1;
}
