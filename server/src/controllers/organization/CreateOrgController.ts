import { Controller, type RequestContext } from 'katal';
import { OrganizationService } from '../../services/OrganizationService';
import { AuditService } from '../../services/AuditService';
import { CreateOrgSchema } from '../../common';

export class CreateOrgController extends Controller {
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

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = CreateOrgSchema.parse(rawBody);

      const org = await this.orgService.createOrganization(userId, validated.name, validated.tier);

      await this.auditService.log({
        orgId: org.id,
        userId,
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: org.id,
        metadata: { name: org.name, tier: org.tier },
      });

      return this.json({ success: true, organization: org }, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to create organization');
    }
  }
}
