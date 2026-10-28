import { Controller, type RequestContext } from 'katal';
import { WorkerHubService } from '../../services/workers/WorkerHubService';
import { WorkerIdSchema } from '../../common';

export class WorkerHeartbeatController extends Controller {
  static __paramTokens = [WorkerHubService];

  constructor(private hubService: WorkerHubService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = WorkerIdSchema.parse(rawBody);

      const success = this.hubService.recordHeartbeat(validated.workerId);
      return this.success({ active: success });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Heartbeat update failed');
    }
  }
}
