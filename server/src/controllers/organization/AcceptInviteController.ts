import { Controller, type RequestContext } from 'katal';
import { OrganizationService } from '../../services/OrganizationService';
import { AuditService } from '../../services/AuditService';
import { AcceptInviteSchema } from '../../common';

export class AcceptInviteController extends Controller {
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
      const validated = AcceptInviteSchema.parse(rawBody);

      const org = await this.orgService.acceptInvitation(validated.token, userId);

      await this.auditService.log({
        orgId: org.id,
        userId,
        action: 'invitation.accepted',
        resourceType: 'organization',
        resourceId: org.id,
      });

      return this.success({
        message: `Successfully joined ${org.name}`,
        orgId: org.id,
        organization: org,
      });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to accept invitation');
    }
  }
}
