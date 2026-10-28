import { Controller, type RequestContext } from 'katal';
import { RecordService } from '../../services/RecordService';
import { upsertRecordSchema } from '../../common';
import { resolveOrgId } from './helpers';

export class UpsertRecordController extends Controller {
  static __paramTokens = [RecordService];

  constructor(private recordService: RecordService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const orgId = resolveOrgId(context);
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = upsertRecordSchema.parse(rawBody);

      const result = await this.recordService.upsertRecord(orgId, validated);
      return this.json(
        {
          success: true,
          data: result.record,
          isNew: result.isNew,
          message: result.isNew ? 'Record created successfully' : 'Record updated and merged successfully',
        },
        result.isNew ? 201 : 200
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to upsert record');
    }
  }
}
