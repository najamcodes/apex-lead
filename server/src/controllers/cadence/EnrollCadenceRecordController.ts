import { Controller, type RequestContext } from 'katal';
import { CadenceEngineService } from '../../services/cadences/CadenceEngineService';
import { EnrollCadenceRecordSchema } from '../../common';

export class EnrollCadenceRecordController extends Controller {
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
      const validated = EnrollCadenceRecordSchema.parse(rawBody);

      const enrollment = await this.cadenceService.enrollRecord(
        orgId,
        cadenceId,
        validated.recordId,
        validated.recipientEmail
      );
      return this.success(enrollment);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to enroll record in cadence');
    }
  }
}
