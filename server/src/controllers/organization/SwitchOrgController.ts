import { Controller, type RequestContext } from 'katal';
import { OrganizationService } from '../../services/OrganizationService';
import { AuditService } from '../../services/AuditService';

export class SwitchOrgController extends Controller {
  static __paramTokens = [OrganizationService, AuditService];

  constructor(
    private orgService: OrganizationService,
    private auditService: AuditService
  ) {
    super();
  }

  async handle(context: RequestContext) {
    const userId = Number(context.user?.id || (context.state as Record<string, unknown>)?.userId);
    if (!userId) return this.unauthorized('Authentication required');

    const targetOrgId = parseInt(context.params?.id, 10);
    if (isNaN(targetOrgId) || targetOrgId <= 0) {
      return this.badRequest('Invalid organization ID');
    }

    try {
      const token = await this.orgService.switchActiveOrganization(userId, targetOrgId);

      await this.auditService.log({
        orgId: targetOrgId,
        userId,
        action: 'organization.switched',
        resourceType: 'organization',
        resourceId: targetOrgId,
      });

      return this.success({
        activeOrgId: targetOrgId,
        token,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.forbidden(message || 'Cannot switch to organization');
    }
  }
}
