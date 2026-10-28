import { Controller, type RequestContext } from 'katal';
import { WorkerHubService } from '../../services/workers/WorkerHubService';

export class ListConnectedWorkersController extends Controller {
  static __paramTokens = [WorkerHubService];

  constructor(private hubService: WorkerHubService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const workers = this.hubService.getConnectedWorkers(orgId);
      return this.success(workers);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to list workers');
    }
  }
}
