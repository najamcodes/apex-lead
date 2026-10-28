import { Controller, type RequestContext } from 'katal';
import { ScraperFederationService } from '../../services/federation/ScraperFederationService';
import { FederationSearchSchema } from '../../common';

export class FederationSearchController extends Controller {
  static __paramTokens = [ScraperFederationService];

  constructor(private federationService: ScraperFederationService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = FederationSearchSchema.parse(rawBody);

      const results = await this.federationService.federate({
        query: validated.query,
        location: validated.location,
        limit: validated.limit,
      });

      return this.success({
        count: results.length,
        data: results,
      });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Federation search failed');
    }
  }
}
