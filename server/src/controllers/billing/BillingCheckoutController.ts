import { Controller, type RequestContext } from 'katal';
import { PolarBillingService } from '../../services/PolarBillingService';
import { CheckoutSchema } from '../../common';
export class BillingCheckoutController extends Controller {
  static __paramTokens = [PolarBillingService];

  constructor(private billingService: PolarBillingService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = Number(context.user?.orgId || (context.state as Record<string, unknown>)?.tenantId);
    const email = context.user?.email || 'user@example.com';
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = CheckoutSchema.parse(rawBody);

      const checkoutUrl = await this.billingService.createCheckoutUrl(
        orgId,
        email,
        validated.tier,
        validated.interval
      );

      return this.success({ checkoutUrl });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Invalid checkout payload');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to initiate checkout');
    }
  }
}
