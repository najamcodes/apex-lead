import { Controller, type RequestContext } from 'katal';
import { OrganizationService } from '../../services/OrganizationService';

export class ListUserOrgsController extends Controller {
  static __paramTokens = [OrganizationService];

  constructor(private orgService: OrganizationService) {
    super();
  }

  async handle(context: RequestContext) {
    const userId = Number(context.user?.id || (context.state as Record<string, unknown>)?.userId);
    if (!userId) return this.unauthorized('Authentication required');

    try {
      const orgs = await this.orgService.getUserOrganizations(userId);
      return this.success({ organizations: orgs });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to list organizations');
    }
  }
}
