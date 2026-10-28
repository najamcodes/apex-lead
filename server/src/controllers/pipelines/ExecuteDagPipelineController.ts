import type { DagGraph } from '../../core/engine/TopologicalSorter';
import { Controller, type RequestContext } from 'katal';
import { DagExecutionEngine } from '../../core/engine/DagExecutionEngine';
import { ExecuteDagPipelineSchema } from '../../common';

export class ExecuteDagPipelineController extends Controller {
  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = ExecuteDagPipelineSchema.parse(rawBody);

      const engine = new DagExecutionEngine();
      const result = await engine.executePipeline((validated.graph as unknown as DagGraph), validated.initialRecords);

      return this.success(result);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Pipeline DAG execution failed');
    }
  }
}
