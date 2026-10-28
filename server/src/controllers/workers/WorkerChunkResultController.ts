import { Controller, type RequestContext } from 'katal';
import { WorkerHubService } from '../../services/workers/WorkerHubService';
import { WorkerChunkResultSchema } from '../../common';

export class WorkerChunkResultController extends Controller {
  static __paramTokens = [WorkerHubService];

  constructor(private hubService: WorkerHubService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = WorkerChunkResultSchema.parse(rawBody);

      this.hubService.handleChunkResult({
        type: 'CHUNK_RESULT',
        workerId: validated.workerId,
        jobId: validated.jobId,
        chunkId: validated.chunkId,
        success: validated.success,
        recordsDiscovered: validated.recordsDiscovered,
        error: validated.error,
        timestamp: Date.now(),
      });

      return this.success({ recorded: true });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Chunk reporting failed');
    }
  }
}
