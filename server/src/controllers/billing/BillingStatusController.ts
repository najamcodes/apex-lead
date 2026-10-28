import { Controller, type RequestContext } from 'katal';
import { QuotaService } from '../../services/QuotaService';

export class BillingStatusController extends Controller {
  static __paramTokens = [QuotaService];

  constructor(private quotaService: QuotaService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const data = await this.quotaService.getUsageAndLimits(orgId);
      return this.success(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to retrieve billing status');
    }
  }
}
