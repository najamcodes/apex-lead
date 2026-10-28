import type { DagGraph } from '../../core/engine/TopologicalSorter';
import { Controller, type RequestContext } from 'katal';
import { TopologicalSorter } from '../../core/engine/TopologicalSorter';
import { ValidateDagPipelineSchema } from '../../common';

export class ValidateDagPipelineController extends Controller {
  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = ValidateDagPipelineSchema.parse(rawBody);

      const { sortedNodeIds, executionLayers, hasCycle } = TopologicalSorter.sort(validated.graph as unknown as DagGraph);

      return this.success({
        isValid: !hasCycle,
        hasCycle,
        executionOrder: sortedNodeIds,
        executionLayers,
      });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Pipeline validation failed');
    }
  }
}
