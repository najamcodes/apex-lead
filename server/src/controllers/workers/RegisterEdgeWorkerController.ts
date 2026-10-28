import { Controller, type RequestContext } from 'katal';
import { WorkerHubService } from '../../services/workers/WorkerHubService';
import { RegisterEdgeWorkerSchema } from '../../common';

export class RegisterEdgeWorkerController extends Controller {
  static __paramTokens = [WorkerHubService];

  constructor(private hubService: WorkerHubService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = RegisterEdgeWorkerSchema.parse(rawBody);

      const worker = this.hubService.registerWorker({
        type: 'WORKER_REGISTER',
        workerId: validated.workerId,
        orgId,
        cpuCores: validated.cpuCores,
        availableMemoryMb: validated.availableMemoryMb,
        clientVersion: validated.clientVersion,
        timestamp: Date.now(),
      });

      return this.json(worker, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Worker registration failed');
    }
  }
}
