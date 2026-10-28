import { Controller, type RequestContext } from 'katal';
import { CadenceEngineService } from '../../services/cadences/CadenceEngineService';
import { AddCadenceStepSchema } from '../../common';

export class AddCadenceStepController extends Controller {
  static __paramTokens = [CadenceEngineService];

  constructor(private cadenceService: CadenceEngineService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const cadenceId = context.params?.id;
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = AddCadenceStepSchema.parse(rawBody);

      const step = await this.cadenceService.addStep(
        cadenceId,
        validated.stepNumber,
        validated.delayDays,
        validated.subjectTemplate,
        validated.bodyTemplate
      );
      return this.json(step, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to add step to cadence');
    }
  }
}
