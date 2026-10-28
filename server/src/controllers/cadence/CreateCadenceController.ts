import { Controller, type RequestContext } from 'katal';
import { CadenceEngineService } from '../../services/cadences/CadenceEngineService';
import { CreateCadenceSchema } from '../../common';

export class CreateCadenceController extends Controller {
  static __paramTokens = [CadenceEngineService];

  constructor(private cadenceService: CadenceEngineService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = CreateCadenceSchema.parse(rawBody);

      const cadence = await this.cadenceService.createCadence(orgId, validated.name, validated.dailyLimit);
      return this.json(cadence, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to create cadence');
    }
  }
}
