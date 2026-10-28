import { Controller, type RequestContext } from 'katal';
import { PolarBillingService } from '../../services/PolarBillingService';
import { getDataSource } from '../../db';
import { OrganizationEntity } from '../../db/entities/OrganizationEntity';

export class BillingPortalController extends Controller {
  static __paramTokens = [PolarBillingService];

  constructor(private billingService: PolarBillingService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const ds = getDataSource();
      const org = await ds.getRepository(OrganizationEntity).findOneBy({ id: orgId });
      if (!org) return this.notFound('Organization not found');

      const settings = JSON.parse(org.settings || '{}');
      const customerId = settings.polar_customer_id;

      if (!customerId) {
        return this.badRequest('No active Polar customer found. Subscribe to a paid plan first.');
      }

      const portalUrl = await this.billingService.createCustomerPortalSession(customerId);
      return this.success({ portalUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to generate customer portal session');
    }
  }
}
