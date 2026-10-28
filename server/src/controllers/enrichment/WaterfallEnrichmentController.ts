import { Controller, type RequestContext } from 'katal';
import { WaterfallEnrichmentService } from '../../services/enrichment/WaterfallEnrichmentService';
import { WaterfallEnrichmentSchema } from '../../common';

export class WaterfallEnrichmentController extends Controller {
  static __paramTokens = [WaterfallEnrichmentService];

  constructor(private enrichmentService: WaterfallEnrichmentService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = Number(context.user?.orgId || (context.state as Record<string, unknown>)?.tenantId);
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = WaterfallEnrichmentSchema.parse(rawBody);

      const result = await this.enrichmentService.enrichContact(orgId, {
        firstName: validated.firstName,
        lastName: validated.lastName,
        domain: validated.domain,
        companyName: validated.companyName,
        phone: validated.phone,
      });

      return this.success(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (message && message.includes('Quota exceeded')) {
        return this.error(message, 402);
      }
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      return this.badRequest(message || 'Failed to enrich contact');
    }
  }
}
