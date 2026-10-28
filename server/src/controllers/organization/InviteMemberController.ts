import { Controller, type RequestContext } from 'katal';
import { OrganizationService } from '../../services/OrganizationService';
import { AuditService } from '../../services/AuditService';
import { InviteMemberSchema } from '../../common';

export class InviteMemberController extends Controller {
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

    const orgId = parseInt(context.params?.id, 10);
    if (isNaN(orgId) || orgId <= 0) {
      return this.badRequest('Invalid organization ID');
    }

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = InviteMemberSchema.parse(rawBody);

      const invite = await this.orgService.createInvitation(
        orgId,
        userId,
        validated.email,
        validated.role
      );

      await this.auditService.log({
        orgId,
        userId,
        action: 'member.invited',
        resourceType: 'invitation',
        metadata: { email: validated.email, role: validated.role },
      });

      return this.json({
        success: true,
        inviteLink: invite.link,
        token: invite.token,
        expiresAt: invite.expiresAt,
      }, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.forbidden(message || 'Failed to create invitation');
    }
  }
}
